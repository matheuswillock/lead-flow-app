"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTimezone } from "@/app/context/TimezoneContext";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const { tz } = useTimezone();
  const [followUpDate, setFollowUpDate] = React.useState<Date | undefined>(initialFollowUpDate);
  const [followUpNotes, setFollowUpNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reasonDetails, setReasonDetails] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (mode === "future_sale") {
      setFollowUpDate(initialFollowUpDate());
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
      setIsSubmitting(true);
      try {
        await onConfirm({
          kind: "future_sale",
          followUpAt: followUpDate.toISOString(),
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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "future_sale" ? "Configurar Venda Futura" : "Informar motivo da perda"}</DialogTitle>
          <DialogDescription>
            Lead: <strong>{leadName}</strong> • Status alvo: <strong>{statusLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-4">
            {confirmationMessage ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                {confirmationMessage}
              </div>
            ) : null}

            {mode === "future_sale" ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Data para entrar em contato</Label>
                  <DateTimePicker
                    date={followUpDate}
                    onDateChange={setFollowUpDate}
                    label=""
                    disabled={isSubmitting}
                    disablePastDates
                    tz={tz}
                  />
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
                  <Label htmlFor="loss-reason">
                    Motivo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="loss-reason"
                    value={reason}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
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
          </div>
        </div>

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

