"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneMissed,
  Plus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { API_CLIENT_BASE } from "@/lib/route-map";

type ContactType = "call" | "whatsapp" | "email" | "meeting" | "visit" | "missed";

type ContactDTO = {
  id: string;
  type: ContactType | string;
  body: string | null;
  outcome: string | null;
  duration: number | null;
  contactDate: string | null;
  contactTime: string | null;
  createdAt: string;
  author: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

type ContactsStats = {
  total: number;
  lastContactDate: string | null;
  effectivenessRate: number;
};

const OUTCOMES_BY_TYPE: Record<ContactType, { value: string; label: string }[]> = {
  call: [
    { value: "answered", label: "Atendeu" },
    { value: "no_answer", label: "Não atendeu" },
    { value: "voicemail", label: "Caixa postal" },
    { value: "callback", label: "Ligará de volta" },
  ],
  whatsapp: [
    { value: "replied", label: "Respondeu" },
    { value: "seen_no_reply", label: "Viu sem responder" },
    { value: "not_delivered", label: "Não entregue" },
  ],
  email: [
    { value: "opened", label: "Abriu" },
    { value: "not_opened", label: "Não abriu" },
    { value: "replied", label: "Respondeu" },
  ],
  meeting: [
    { value: "attended", label: "Compareceu" },
    { value: "no_show", label: "Faltou" },
    { value: "rescheduled", label: "Remarcou" },
  ],
  visit: [
    { value: "attended", label: "Compareceu" },
    { value: "no_show", label: "Faltou" },
    { value: "rescheduled", label: "Remarcou" },
  ],
  missed: [],
};

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  visit: "Visita",
  missed: "Perdida",
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "call":
      return <Phone className="size-4" />;
    case "whatsapp":
      return <MessageCircle className="size-4" />;
    case "email":
      return <Mail className="size-4" />;
    case "meeting":
      return <Users className="size-4" />;
    case "visit":
      return <MapPin className="size-4" />;
    case "missed":
      return <PhoneMissed className="size-4" />;
    default:
      return <Phone className="size-4" />;
  }
}

function outcomeLabel(type: string, outcome: string | null): string | null {
  if (!outcome) return null;
  const options = OUTCOMES_BY_TYPE[type as ContactType] ?? [];
  return options.find((o) => o.value === outcome)?.label ?? outcome;
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function groupKey(contact: ContactDTO): string {
  if (contact.contactDate) return contact.contactDate.slice(0, 10);
  return contact.createdAt.slice(0, 10);
}

interface LeadContactsTabProps {
  leadId: string;
  teamId: string;
  supabaseId: string;
}

export function LeadContactsTab({ leadId, teamId, supabaseId }: LeadContactsTabProps) {
  const [stats, setStats] = useState<ContactsStats>({
    total: 0,
    lastContactDate: null,
    effectivenessRate: 0,
  });
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [type, setType] = useState<ContactType>("call");
  const [outcome, setOutcome] = useState("");
  const [contactDate, setContactDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contactTime, setContactTime] = useState("");
  const [duration, setDuration] = useState("");
  const [body, setBody] = useState("");
  const requestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }),
    [supabaseId, teamId]
  );

  const load = useCallback(async () => {
    const key = `${leadId}:${teamId}`;
    if (inFlightRef.current && requestKeyRef.current === key) return;
    inFlightRef.current = true;
    requestKeyRef.current = key;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/contacts`, { headers });
      if (!res.ok) throw new Error("Falha ao carregar contatos");
      const data = await res.json();
      const result = data?.result ?? data;
      setStats(result?.stats ?? { total: 0, lastContactDate: null, effectivenessRate: 0 });
      setContacts(Array.isArray(result?.contacts) ? result.contacts : []);
    } catch (error) {
      console.error("[LeadContactsTab] Erro ao carregar:", error);
      toast.error("Não foi possível carregar os contatos");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [headers, leadId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const options = OUTCOMES_BY_TYPE[type];
    setOutcome(options[0]?.value ?? "");
  }, [type]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContactDTO[]>();
    for (const contact of contacts) {
      const key = groupKey(contact);
      const list = map.get(key) ?? [];
      list.push(contact);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [contacts]);

  const showDuration = type === "call" || type === "meeting" || type === "visit";
  const outcomeOptions = OUTCOMES_BY_TYPE[type];

  const resetForm = () => {
    setType("call");
    setOutcome("answered");
    setContactDate(new Date().toISOString().slice(0, 10));
    setContactTime("");
    setDuration("");
    setBody("");
    setFormOpen(false);
  };

  const saveContact = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type,
        contactDate: contactDate || undefined,
        contactTime: contactTime || undefined,
        body: body.trim() || undefined,
      };
      if (type !== "missed" && outcome) payload.outcome = outcome;
      if (showDuration && duration) payload.duration = Number(duration);

      const res = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.errorMessages?.[0] ?? "Falha ao registrar contato");
      }
      toast.success("Contato registrado");
      resetForm();
      await load();
    } catch (error) {
      console.error("[LeadContactsTab] Erro ao salvar:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o contato");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-1">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Último contato</p>
          <p className="text-sm font-semibold">{formatRelativeDate(stats.lastContactDate)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Efetividade</p>
          <p className="text-lg font-semibold">{stats.effectivenessRate}%</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setFormOpen((v) => !v)}>
          <Plus data-icon="inline-start" />
          Registrar contato
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button type="button" size="sm" variant="outline" disabled>
                  <Bell data-icon="inline-start" />
                  Agendar alerta
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {formOpen ? (
        <div className="rounded-lg border border-border/60 p-3">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as ContactType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {outcomeOptions.length > 0 ? (
              <Field>
                <FieldLabel>Resultado</FieldLabel>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="contact-date">Data</FieldLabel>
                <Input
                  id="contact-date"
                  type="date"
                  value={contactDate}
                  onChange={(e) => setContactDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-time">Horário</FieldLabel>
                <Input
                  id="contact-time"
                  type="time"
                  value={contactTime}
                  onChange={(e) => setContactTime(e.target.value)}
                />
              </Field>
            </div>

            {showDuration ? (
              <Field>
                <FieldLabel htmlFor="contact-duration">Duração (min)</FieldLabel>
                <Input
                  id="contact-duration"
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="contact-notes">Notas</FieldLabel>
              <Textarea
                id="contact-notes"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Observações do contato"
              />
            </Field>
          </FieldGroup>

          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" disabled={isSaving} onClick={() => void saveContact()}>
              {isSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([dateKey, items]) => (
            <section key={dateKey} className="flex flex-col gap-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatRelativeDate(dateKey)}
              </h4>
              {items.map((contact) => {
                const authorLabel = contact.author?.fullName || contact.author?.email || "—";
                const notesOpen = expandedNotes[contact.id] === true;
                return (
                  <div
                    key={contact.id}
                    className="rounded-lg border border-border/60 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          <TypeIcon type={contact.type} />
                        </span>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {TYPE_LABELS[contact.type] ?? contact.type}
                            </span>
                            {contact.outcome ? (
                              <Badge variant="secondary" className="text-xs">
                                {outcomeLabel(contact.type, contact.outcome)}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[contact.contactTime, contact.duration != null ? `${contact.duration} min` : null]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="size-6">
                              <AvatarImage src={contact.author?.avatarUrl ?? undefined} alt={authorLabel} />
                              <AvatarFallback className="text-[10px]">
                                {authorLabel.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>{authorLabel}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {contact.body ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedNotes((prev) => ({
                              ...prev,
                              [contact.id]: !notesOpen,
                            }))
                          }
                        >
                          Notas
                          {notesOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </button>
                        <p
                          className={cn(
                            "mt-1 text-sm text-muted-foreground",
                            !notesOpen && "line-clamp-2"
                          )}
                        >
                          {contact.body}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
