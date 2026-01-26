"use client";

import { useState } from "react";
import { CreditCard, QrCode, FileText, ArrowLeft, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PaymentMethod } from "./signUpContext";

interface PaymentSelectionProps {
  onSelectPayment: (method: PaymentMethod) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
  selectedMethod: PaymentMethod | null;
}

export function PaymentSelection({
  onSelectPayment,
  onBack,
  isLoading = false,
  error,
  selectedMethod,
}: PaymentSelectionProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(selectedMethod);

  const paymentMethods = [
    {
      id: 'CREDIT_CARD' as PaymentMethod,
      icon: CreditCard,
      title: 'Cartão de Crédito',
      description: 'Cobrança automática mensal no seu cartão',
      recommended: true,
    },
    {
      id: 'PIX' as PaymentMethod,
      icon: QrCode,
      title: 'PIX',
      description: 'Pagamento da primeira mensalidade via PIX',
      recommended: false,
    },
    {
      id: 'BOLETO' as PaymentMethod,
      icon: FileText,
      title: 'Boleto Bancário',
      description: 'Pagamento da primeira mensalidade via Boleto',
      recommended: false,
    },
  ];

  const handleProceed = () => {
    if (method) {
      onSelectPayment(method);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <HeartPulse className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Escolha a forma de pagamento</h1>
            <p className="text-sm text-muted-foreground">
              Selecione como deseja pagar sua assinatura mensal
            </p>
          </div>
        </div>

        {/* Payment Methods */}
        <RadioGroup
          value={method || undefined}
          onValueChange={(value) => setMethod(value as PaymentMethod)}
          className="space-y-3"
        >
          {paymentMethods.map((pm) => {
            const Icon = pm.icon;
            const isSelected = method === pm.id;

            return (
              <Card
                key={pm.id}
                className={`relative cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setMethod(pm.id)}
              >
                <div className="flex items-start gap-4 p-4">
                  <RadioGroupItem value={pm.id} id={pm.id} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={pm.id}
                      className="flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <Icon className="h-5 w-5" />
                      {pm.title}
                      {pm.recommended && (
                        <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Recomendado
                        </span>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pm.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </RadioGroup>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Pricing Info */}
        <div className="p-4 rounded-md bg-muted/50 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Plano Profissional</span>
            <span className="text-lg font-bold">R$ 59,90/mês</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sistema completo de gestão de leads com pipeline kanban, analytics em tempo real e gestão de equipe.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleProceed}
            disabled={!method || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Processando...' : 'Pagar'}
          </Button>
        </div>
      </div>
    </main>
  );
}
