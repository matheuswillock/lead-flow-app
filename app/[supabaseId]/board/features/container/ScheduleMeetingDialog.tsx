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

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduleSuccess: () => void;
  closers: UserAssociated[];
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  lead,
  onScheduleSuccess,
  closers,
}: ScheduleMeetingDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const [meetingDate, setMeetingDate] = useState<Date>();
  const [notes, setNotes] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [extraGuestsInput, setExtraGuestsInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMeetingDate(lead.meetingDate ? new Date(lead.meetingDate) : undefined);
    setNotes(lead.meetingNotes || "");
    setMeetingLink(lead.meetingLink || "");
    setCloserId(lead.closerId || "");
    setExtraGuestsInput("");
    if (!lead.closerId && closers.length === 1) {
      setCloserId(closers[0].id);
    }
  }, [open, lead, closers]);

  const parseExtraGuests = (value: string): string[] => {
    const raw = value
      .split(/[,;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const valid = raw.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    return Array.from(new Set(valid.map((email) => email.toLowerCase())));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!meetingDate) {
      toast.error("Selecione uma data e hora para o agendamento");
      return;
    }
    if (closers.length > 0 && !closerId) {
      toast.error("Selecione um closer para a reuniao");
      return;
    }

    const extraGuests = parseExtraGuests(extraGuestsInput);

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
          notes: notes || `Reunião agendada com ${lead.name}`,
          meetingLink: meetingLink || undefined,
          closerId: closerId || undefined,
          extraGuests: extraGuests.length ? extraGuests : undefined,
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
      setNotes("");
      setMeetingLink("");
      setExtraGuestsInput("");
      
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
              <Input
                id="extraGuests"
                type="text"
                placeholder="ex: convidado1@email.com, convidado2@email.com"
                value={extraGuestsInput}
                onChange={(e) => setExtraGuestsInput(e.target.value)}
              />
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
