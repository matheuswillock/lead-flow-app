"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import type { Output } from "@/lib/output";
import { API_CLIENT_BASE } from "@/lib/route-map";

export type ResendScheduleTarget = "all" | "single" | "new";

export type ResendScheduleParticipantSeed = {
  leadEmail?: string | null;
  leadName?: string;
  closerEmail?: string | null;
  closerName?: string | null;
  assigneeEmail?: string | null;
  assigneeName?: string | null;
  extraParticipantEmails?: string[];
};

type ResendScheduleInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  supabaseId: string;
  teamId?: string | null;
  participants: ResendScheduleParticipantSeed;
  closerUsesGoogleCalendar?: boolean;
  onSuccess?: () => void;
  submitResend?: (
    payload: {
      target: ResendScheduleTarget;
      email?: string;
      emails?: string[];
    }
  ) => Promise<Output>;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function ResendScheduleInviteDialog({
  open,
  onOpenChange,
  leadId,
  supabaseId,
  teamId,
  participants,
  closerUsesGoogleCalendar = false,
  onSuccess,
  submitResend,
}: ResendScheduleInviteDialogProps) {
  const [resendTarget, setResendTarget] = useState<ResendScheduleTarget>("all");
  const [resendEmail, setResendEmail] = useState("");
  const [newParticipantDraft, setNewParticipantDraft] = useState("");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [scheduleGuests, setScheduleGuests] = useState<string[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setResendTarget("all");
      setResendEmail("");
      setNewParticipantDraft("");
      setNewParticipants([]);
      setScheduleGuests([]);
      setScheduleLoading(false);
      setIsSubmitting(false);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const fetchScheduleGuests = async () => {
      setScheduleLoading(true);
      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/schedule`, {
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            ...(teamId ? { "x-team-id": teamId } : {}),
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isActive) setScheduleGuests([]);
          return;
        }
        const data = await response.json().catch(() => null);
        const schedules = (data?.result || []) as Array<{ extraGuests?: string[] }>;
        if (isActive) {
          setScheduleGuests(schedules[0]?.extraGuests || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (isActive) setScheduleGuests([]);
        console.warn("[ResendScheduleInviteDialog] Falha ao carregar convidados:", error);
      } finally {
        if (isActive) setScheduleLoading(false);
      }
    };

    void fetchScheduleGuests();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [open, leadId, supabaseId, teamId]);

  const participantOptions = useMemo(() => {
    const options: { label: string; email: string }[] = [];

    if (participants.leadEmail) {
      options.push({
        label: `${participants.leadName || "Lead"} (Lead)`,
        email: participants.leadEmail,
      });
    }
    if (participants.closerEmail) {
      options.push({
        label: `${participants.closerName || participants.closerEmail} (Closer)`,
        email: participants.closerEmail,
      });
    }
    if (participants.assigneeEmail) {
      options.push({
        label: `${participants.assigneeName || participants.assigneeEmail} (SDR)`,
        email: participants.assigneeEmail,
      });
    }
    (participants.extraParticipantEmails ?? []).forEach((email) => {
      if (!options.some((option) => option.email.toLowerCase() === email.toLowerCase())) {
        options.push({ label: email, email });
      }
    });
    scheduleGuests.forEach((guestEmail) => {
      if (!options.some((option) => option.email.toLowerCase() === guestEmail.toLowerCase())) {
        options.push({ label: guestEmail, email: guestEmail });
      }
    });

    const seen = new Set<string>();
    return options.filter((option) => {
      const normalized = option.email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [participants, scheduleGuests]);

  const addNewParticipants = useCallback((values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail);
    if (normalized.length === 0) return;
    setNewParticipants((prev) => Array.from(new Set([...prev, ...normalized])));
  }, []);

  const handleNewParticipantInput = useCallback(
    (value: string) => {
      if (!value) {
        setNewParticipantDraft("");
        return;
      }
      const parts = value.split(/[,;\s]+/);
      if (parts.length === 1) {
        setNewParticipantDraft(value);
        return;
      }
      const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
      addNewParticipants(parts);
      setNewParticipantDraft(last);
    },
    [addNewParticipants]
  );

  const commitNewParticipantDraft = useCallback(() => {
    if (!newParticipantDraft.trim()) return;
    handleNewParticipantInput(`${newParticipantDraft} `);
  }, [handleNewParticipantInput, newParticipantDraft]);

  const defaultSubmitResend = useCallback(
    async (payload: {
      target: ResendScheduleTarget;
      email?: string;
      emails?: string[];
    }) => {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/schedule/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          ...(teamId ? { "x-team-id": teamId } : {}),
        },
        body: JSON.stringify(payload),
      });
      return (await response.json()) as Output;
    },
    [leadId, supabaseId, teamId]
  );

  const handleResendInvite = async () => {
    if (isSubmitting) return;
    if (resendTarget === "single" && !resendEmail) {
      toast.error("Selecione um participante para reenviar o convite");
      return;
    }
    if (resendTarget === "new" && newParticipants.length === 0) {
      toast.error("Informe pelo menos um participante");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Reenviando convite...");
    try {
      const submit = submitResend ?? defaultSubmitResend;
      const result = await submit({
        target: resendTarget,
        email: resendTarget === "single" ? resendEmail : undefined,
        emails: resendTarget === "new" ? newParticipants : undefined,
      });

      if (!result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao reenviar convite");
      }

      const warningMessage = Array.isArray(result.successMessages)
        ? result.successMessages.find((message) => message.toLowerCase().startsWith("aviso"))
        : undefined;
      const successMessage =
        Array.isArray(result.successMessages) && result.successMessages.length > 0
          ? result.successMessages[0]
          : "Convite reenviado com sucesso!";

      const toastHandler =
        warningMessage && successMessage.toLowerCase().includes("não reenviados")
          ? toast.info
          : toast.success;

      toastHandler(successMessage, {
        id: loadingToast,
        duration: 3000,
      });
      if (warningMessage) {
        toast.info(warningMessage, { duration: 5000 });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = toUserToastMessage(error);
      toast.error(message, { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reenviar convite</DialogTitle>
          <DialogDescription>
            Escolha se deseja reenviar o convite para todos ou para um participante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {closerUsesGoogleCalendar && (
            <p className="text-xs text-muted-foreground">
              Com Google Calendar conectado, &quot;Todos&quot; reenvia via Calendar. &quot;Um
              participante&quot; ou &quot;Novo&quot; enviam por e-mail (Resend).
            </p>
          )}

          <RadioGroup
            value={resendTarget}
            onValueChange={(value) => setResendTarget(value as ResendScheduleTarget)}
            className="grid gap-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="resend-all" />
              <Label htmlFor="resend-all">Todos os participantes</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="resend-single" />
              <Label htmlFor="resend-single">Somente um participante</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id="resend-new" />
              <Label htmlFor="resend-new">Novo participante</Label>
            </div>
          </RadioGroup>

          {resendTarget === "single" && (
            <div className="grid gap-2">
              <Label>Participante</Label>
              <Select value={resendEmail} onValueChange={setResendEmail}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={scheduleLoading ? "Carregando..." : "Selecione o e-mail"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {participantOptions.map((option) => (
                    <SelectItem key={option.email} value={option.email}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {resendTarget === "new" && (
            <div className="grid gap-2">
              <Label>Novo participante</Label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                {newParticipants.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                      onClick={() =>
                        setNewParticipants((prev) => prev.filter((item) => item !== email))
                      }
                      aria-label={`Remover ${email}`}
                    >
                      <X data-icon="inline-start" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="text"
                  value={newParticipantDraft}
                  onChange={(event) => handleNewParticipantInput(event.target.value)}
                  onBlur={commitNewParticipantDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitNewParticipantDraft();
                    }
                  }}
                  placeholder="ex: participante@email.com"
                  className="min-w-35 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Separe os e-mails por vírgula ou espaço.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleResendInvite()} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Reenviando...
              </>
            ) : (
              "Reenviar convite"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
