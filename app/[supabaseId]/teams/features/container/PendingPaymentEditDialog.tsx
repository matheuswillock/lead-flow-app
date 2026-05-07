"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PendingPaymentEditDialogProps {
  open: boolean;
  loading: boolean;
  submitting: boolean;
  billingType: "PIX" | "CREDIT_CARD";
  addonLabel: string;
  addonDetail: string;
  totalCharge: number;
  remainingMonths: number;
  onBillingTypeChange: (billingType: "PIX" | "CREDIT_CARD") => void;
  onSubmit: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PendingPaymentEditDialog({
  open,
  loading,
  submitting,
  billingType,
  addonLabel,
  addonDetail,
  totalCharge,
  remainingMonths,
  onBillingTypeChange,
  onSubmit,
  onOpenChange,
}: PendingPaymentEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar pagamento pendente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/60 p-3">
            <p className="text-sm font-semibold">{addonLabel}</p>
            <p className="text-xs text-muted-foreground">{addonDetail}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span>Total da fatura</span>
              <span className="font-semibold">{formatCurrency(totalCharge)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
              <span>Meses restantes</span>
              <span>{remainingMonths}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <RadioGroup
              value={billingType}
              onValueChange={(value) => onBillingTypeChange(value as "PIX" | "CREDIT_CARD")}
              className="grid grid-cols-2 gap-3"
              disabled={loading || submitting}
            >
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <RadioGroupItem value="PIX" />
                <span>PIX</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <RadioGroupItem value="CREDIT_CARD" />
                <span>Cartão de crédito</span>
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={loading || submitting}>
            {submitting ? "Salvando..." : "Salvar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
