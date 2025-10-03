"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { Lead } from "../context/BoardTypes";
import { useParams } from "next/navigation";

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduleSuccess: () => void;
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  lead,
  onScheduleSuccess,
}: ScheduleMeetingDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const [meetingDate, setMeetingDate] = useState<Date>();
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!meetingDate) {
      toast.error("Selecione uma data e hora para o agendamento");
      return;
    }

    // 🚀 OPTIMISTIC UPDATE - Fechar dialog e mostrar loading toast imediatamente
    const loadingToast = toast.loading("Agendando reunião...");
    onOpenChange(false);
    
    // Chamar onScheduleSuccess imediatamente para UI responsiva
    // Isso vai disparar refreshLeads() que buscará os dados atualizados
    onScheduleSuccess();

    try {
      setIsSubmitting(true);

      // Criar agendamento
      const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          date: meetingDate.toISOString(),
          notes: notes || `Reunião agendada com ${lead.name}`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.isValid) {
        throw new Error(result.errorMessages?.join(", ") || "Erro ao agendar reunião");
      }

      // Atualizar status do lead para scheduled
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

      // ✅ Sucesso - Atualizar loading toast para success
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
    } catch (error) {
      console.error("Erro ao agendar reunião:", error);
      
      // ❌ Erro - Atualizar loading toast para error
      toast.error(error instanceof Error ? error.message : "Erro ao agendar reunião", {
        id: loadingToast,
        duration: 5000,
      });
      
      // Reabrir dialog em caso de erro para usuário tentar novamente
      onOpenChange(true);
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
