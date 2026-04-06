"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type LeadStatusTriggerPayload =
  | {
      kind: "future_sale";
      followUpAt: string;
      followUpNotes?: string;
      confirmRuleId?: string;
    }
  | {
      kind: "loss_reason";
      reason: string;
      reasonDetails?: string;
      confirmRuleId?: string;
    };

type LeadStatusTriggerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "future_sale" | "loss_reason";
  leadName: string;
  statusLabel: string;
  confirmationMessage?: string | null;
  confirmationRuleId?: string | null;
  onConfirm: (payload: LeadStatusTriggerPayload) => Promise<void>;
};

const initialFollowUpDate = () => new Date(Date.now() + 60 * 60 * 1000);
const initialFollowUpTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function LeadStatusTriggerDialog({
  open,
  onOpenChange,
  mode,
  leadName,
  statusLabel,
  confirmationMessage,
  confirmationRuleId,
  onConfirm,
}: LeadStatusTriggerDialogProps) {
  const [followUpDate, setFollowUpDate] = React.useState<Date | undefined>(initialFollowUpDate);
  const [followUpTime, setFollowUpTime] = React.useState<string>(() => initialFollowUpTime(initialFollowUpDate()));
  const [followUpNotes, setFollowUpNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reasonDetails, setReasonDetails] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (mode === "future_sale") {
      const next = initialFollowUpDate();
      setFollowUpDate(next);
      setFollowUpTime(initialFollowUpTime(next));
      setFollowUpNotes("");
    } else {
      setReason("");
      setReasonDetails("");
    }
  }, [mode, open]);

  const handleConfirm = async () => {
    if (mode === "future_sale") {
      if (!followUpDate) {
        toast.error("Informe a data de contato.");
        return;
      }
      const [hours, minutes] = followUpTime.split(":").map(Number);
      const combined = new Date(followUpDate);
      combined.setHours(hours, minutes, 0, 0);
      setIsSubmitting(true);
      try {
        await onConfirm({
          kind: "future_sale",
          followUpAt: combined.toISOString(),
          followUpNotes: followUpNotes.trim() || undefined,
          confirmRuleId: confirmationRuleId || undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!reason.trim()) {
      toast.error("Informe o motivo para concluir a alteração.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        kind: "loss_reason",
        reason: reason.trim(),
        reasonDetails: reasonDetails.trim() || undefined,
        confirmRuleId: confirmationRuleId || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "future_sale" ? "Configurar Venda Futura" : "Informar motivo da perda"}</DialogTitle>
          <DialogDescription>
            Lead: <strong>{leadName}</strong> • Status alvo: <strong>{statusLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        {confirmationMessage ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            {confirmationMessage}
          </div>
        ) : null}

        {mode === "future_sale" ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Data para entrar em contato</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("flex-1 justify-start text-left font-normal", !followUpDate && "text-muted-foreground")}
                      disabled={isSubmitting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {followUpDate ? format(followUpDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followUpDate}
                      onSelect={setFollowUpDate}
                      locale={ptBR}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                  disabled={isSubmitting}
                  className="w-[120px]"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="future-sale-notes">Comentários</Label>
              <Textarea
                id="future-sale-notes"
                rows={4}
                value={followUpNotes}
                onChange={(event) => setFollowUpNotes(event.target.value)}
                placeholder="Contexto para o próximo contato com o lead..."
                disabled={isSubmitting}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="loss-reason">Motivo <span className="text-destructive">*</span></Label>
              <Input
                id="loss-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex: Cliente desistiu, proposta recusada..."
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loss-reason-details">Detalhes</Label>
              <Textarea
                id="loss-reason-details"
                rows={4}
                value={reasonDetails}
                onChange={(event) => setReasonDetails(event.target.value)}
                placeholder="Detalhes adicionais sobre o motivo..."
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

