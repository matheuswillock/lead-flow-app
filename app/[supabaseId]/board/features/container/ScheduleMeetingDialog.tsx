"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { Lead } from "../context/BoardTypes";
import { useParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X } from "lucide-react";

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduleSuccess: () => void;
  closers: UserAssociated[];
  teamMembers?: UserAssociated[];
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  lead,
  onScheduleSuccess,
  closers,
  teamMembers,
}: ScheduleMeetingDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const [meetingDate, setMeetingDate] = useState<Date>();
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [extraGuests, setExtraGuests] = useState<string[]>([]);
  const [extraGuestsDraft, setExtraGuestsDraft] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const members = teamMembers && teamMembers.length > 0 ? teamMembers : closers;

  useEffect(() => {
    if (!open) return;
    setMeetingDate(lead.meetingDate ? new Date(lead.meetingDate) : undefined);
    setMeetingTitle(lead.meetingTitle || `Reunião com ${lead.name}`);
    setNotes(lead.meetingNotes || "");
    setMeetingLink(lead.meetingLink || "");
    setCloserId(lead.closerId || "");
    setExtraGuests([]);
    setExtraGuestsDraft("");
    if (!lead.closerId && closers.length === 1) {
      setCloserId(closers[0].id);
    }
  }, [open, lead, closers]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const addExtraGuests = (values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail);
    if (normalized.length === 0) return;
    setExtraGuests((prev) => Array.from(new Set([...prev, ...normalized])));
  };

  const handleExtraGuestsInput = (value: string) => {
    if (!value) {
      setExtraGuestsDraft("");
      return;
    }
    const parts = value.split(/[,;\s]+/);
    if (parts.length === 1) {
      setExtraGuestsDraft(value);
      return;
    }
    const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
    addExtraGuests(parts);
    setExtraGuestsDraft(last);
  };

  const commitExtraGuestDraft = () => {
    if (!extraGuestsDraft.trim()) return;
    handleExtraGuestsInput(`${extraGuestsDraft} `);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!meetingDate) {
      toast.error("Selecione uma data e hora para o agendamento");
      return;
    }
    if (!meetingTitle.trim()) {
      toast.error("Informe o titulo da reunião");
      return;
    }
    if (closers.length > 0 && !closerId) {
      toast.error("Selecione um closer para a reuniao");
      return;
    }

    const guests = extraGuests;

    setIsSubmitting(true);
    const loadingToast = toast.loading("Agendando reunião...");

    try {
      // 1. Criar agendamento
      const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          date: meetingDate.toISOString(),
          meetingTitle: meetingTitle.trim(),
          notes: notes || `Reunião agendada com ${lead.name}`,
          meetingLink: meetingLink || undefined,
          closerId: closerId || undefined,
          extraGuests: guests.length ? guests : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.isValid) {
        throw new Error(result.errorMessages?.join(", ") || "Erro ao agendar reunião");
      }

      // 2. Atualizar status do lead para scheduled
      const statusResponse = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          status: "scheduled",
        }),
      });

      if (!statusResponse.ok) {
        console.warn("Erro ao atualizar status do lead");
      }

      // ✅ Sucesso - Fechar dialog e atualizar UI
      toast.success(`Reunião agendada para ${meetingDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`, {
        id: loadingToast,
        duration: 4000,
      });
      
      // Limpar form
      setMeetingDate(undefined);
      setMeetingTitle("");
      setNotes("");
      setMeetingLink("");
      setExtraGuests([]);
      setExtraGuestsDraft("");
      
      // Fechar dialog
      onOpenChange(false);
      
      // 3. Atualizar board (recarregar leads)
      onScheduleSuccess();
      
    } catch (error) {
      console.error("Erro ao agendar reunião:", error);
      
      // ❌ Erro - Mostrar mensagem de erro
      toast.error(error instanceof Error ? error.message : "Erro ao agendar reunião", {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
          <DialogDescription>
            Agendar reunião com <strong>{lead.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
            {/* Data e Hora */}
            <DateTimePicker
              date={meetingDate}
              onDateChange={setMeetingDate}
              label="Data e Horário da Reunião"
              required
              disablePastDates
            />

            {/* Titulo da reuniao */}
            <div className="grid gap-2">
              <Label htmlFor="meetingTitle">Titulo da reuniao</Label>
              <Input
                id="meetingTitle"
                placeholder="Ex: Apresentação da proposta"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                required
              />
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre a reunião..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Link da reunião */}
            <div className="grid gap-2">
              <Label htmlFor="meetingLink">Link da reunião (opcional)</Label>
              <Input
                id="meetingLink"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>

            {/* Convidados extras */}
            <div className="grid gap-2">
              <Label htmlFor="extraGuests">Convidados extras (emails)</Label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                {extraGuests.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                      onClick={() =>
                        setExtraGuests((prev) => prev.filter((item) => item !== email))
                      }
                      aria-label={`Remover ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="extraGuests"
                  type="text"
                  value={extraGuestsDraft}
                  onChange={(e) => handleExtraGuestsInput(e.target.value)}
                  onBlur={commitExtraGuestDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExtraGuestDraft();
                    }
                  }}
                  placeholder="ex: convidado1@email.com, convidado2@email.com"
                  className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Adicionar membros do time:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Selecionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60">
                    {members
                      .filter((member) => member.email)
                      .map((member) => {
                        const email = member.email!;
                        const checked = extraGuests.includes(email.toLowerCase());
                        return (
                          <DropdownMenuCheckboxItem
                            key={member.id}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked) {
                                addExtraGuests([email]);
                              } else {
                                setExtraGuests((prev) =>
                                  prev.filter((item) => item !== email.toLowerCase())
                                );
                              }
                            }}
                          >
                            {member.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-xs text-muted-foreground">
                Separe os emails por virgula ou espaco.
              </p>
            </div>

            {/* Closer */}
            <div className="grid gap-2">
              <Label>Closer</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder={closers.length ? "Selecione um closer" : "Sem closers disponiveis"} />
                </SelectTrigger>
                <SelectContent>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Agendando..." : "Agendar Reunião"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
