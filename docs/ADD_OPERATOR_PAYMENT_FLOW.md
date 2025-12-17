# 🚀 Implementação do Fluxo de Pagamento para Adicionar Operador

## ✅ Já Implementado

1. **UseCase**: `SubscriptionUpgradeUseCase` - Lógica de negócio para pagamento
2. **Migration**: Tabela `pending_operators` criada
3. **API Route**: `/api/v1/operators/add-payment` - Endpoint para criar pagamento

## 🔨 Próximos Passos

### 1. Atualizar Tipos do Manager Users

Adicione em `app/[supabaseId]/manager-users/features/types/index.ts`:

```typescript
export interface PendingOperator {
  id: string;
  name: string;
  email: string;
  role: string;
  paymentId: string;
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'FAILED';
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  operatorCreated: boolean;
  createdAt: string;
}

export interface OperatorWithStatus extends ManagerUser {
  status: 'active' | 'pending_payment' | 'payment_failed';
  pendingPayment?: PendingOperator;
}
```

### 2. Criar Componente de Pagamento

Crie `app/[supabaseId]/manager-users/features/container/PaymentDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Copy } from "@/components/ui/copy";
import { Loader2, CreditCard, QrCode } from "lucide-react";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorData: {
    name: string;
    email: string;
    role: string;
  };
  onPaymentCreated: (paymentData: any) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  operatorData,
  onPaymentCreated
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  const handleCreatePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/operators/add-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: 'SUBSTITUIR_COM_MANAGER_ID',
          operatorData,
          paymentMethod
        })
      });

      const result = await response.json();
      
      if (result.isValid) {
        setPaymentData(result.result);
        onPaymentCreated(result.result);
      }
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pagamento para Adicionar Operador</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!paymentData ? (
            <>
              <div>
                <h3 className="font-medium mb-2">Detalhes do Operador</h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><strong>Nome:</strong> {operatorData.name}</p>
                  <p><strong>Email:</strong> {operatorData.email}</p>
                  <p><strong>Valor:</strong> R$ 20,00/mês</p>
                </div>
              </div>

              <div>
                <Label>Método de Pagamento</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PIX" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                      <QrCode className="h-4 w-4" />
                      PIX (Aprovação Instantânea)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CREDIT_CARD" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="h-4 w-4" />
                      Cartão de Crédito
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={handleCreatePayment} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar Pagamento
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Pagamento criado! Complete o pagamento para adicionar o operador.
                </p>
              </div>

              {paymentMethod === "PIX" && paymentData.pixCopyPaste && (
                <Card className="p-4 space-y-3">
                  <Label>Código PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={paymentData.pixCopyPaste}
                      className="flex-1 text-xs p-2 border rounded"
                    />
                    <Copy value={paymentData.pixCopyPaste} />
                  </div>
                  {paymentData.pixQrCode && (
                    <div className="text-center">
                      <img 
                        src={paymentData.pixQrCode} 
                        alt="QR Code PIX"
                        className="mx-auto max-w-[200px]"
                      />
                    </div>
                  )}
                </Card>
              )}

              <p className="text-xs text-center text-muted-foreground">
                Após a confirmação do pagamento, o operador será criado automaticamente.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Atualizar Coluna de Status na Tabela

Atualize `app/[supabaseId]/manager-users/features/container/columns.tsx`:

```typescript
// Adicione esta coluna
{
  accessorKey: "status",
  header: "Status",
  cell: ({ row }) => {
    const user = row.original;
    const status = user.status || "active";
    
    const statusConfig = {
      active: { label: "Ativo", variant: "default" },
      pending_payment: { label: "Aguardando Pagamento", variant: "warning" },
      payment_failed: { label: "Pagamento Falhou", variant: "destructive" }
    };

    const config = statusConfig[status] || statusConfig.active;

    return (
      <Badge variant={config.variant as any}>
        {config.label}
      </Badge>
    );
  }
}
```

### 4. Integrar PaymentDialog no Fluxo

Em `UserFormDialog.tsx`, ao invés de criar direto, abra o `PaymentDialog`:

```typescript
const handleSubmit = async (data: any) => {
  if (isEditMode) {
    // Edição normal
    await onSubmit(data);
  } else {
    // Novo operador - abrir dialog de pagamento
    setShowPaymentDialog(true);
    setPendingOperatorData(data);
  }
};
```

### 5. Webhook para Confirmar Pagamento

O webhook do Asaas já existe em `app/api/webhooks/asaas/route.ts`.
Adicione lógica para processar pagamentos de operadores:

```typescript
if (payment.externalReference?.startsWith('operator-')) {
  // Confirmar e criar operador
  await subscriptionUpgradeUseCase.confirmPaymentAndCreateOperator(payment.id);
}
```

### 6. Polling de Status (Opcional)

Crie um hook para verificar status do pagamento:

```typescript
export function usePaymentPolling(paymentId: string) {
  useEffect(() => {
    if (!paymentId) return;

    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/operators/payment-status/${paymentId}`);
      const result = await response.json();
      
      if (result.isValid && result.result.status === 'CONFIRMED') {
        // Operador criado!
        clearInterval(interval);
        window.location.reload();
      }
    }, 5000); // Check a cada 5 segundos

    return () => clearInterval(interval);
  }, [paymentId]);
}
```

## 📝 Fluxo Completo

1. User clica "Adicionar Operador"
2. Preenche dados do operador
3. Abre PaymentDialog com opções PIX/Cartão
4. Sistema cria cobrança no Asaas (R$ 20)
5. Mostra QR Code PIX ou formulário de cartão
6. Salva operador como "pending" no banco
7. Webhook Asaas confirma pagamento
8. Sistema cria o operador automaticamente
9. Operador aparece como "Ativo" na lista

## 🎯 Próxima Sessão

Na próxima sessão, posso ajudar a:
- Implementar os componentes completos
- Testar o fluxo end-to-end
- Adicionar notificações por email
- Melhorar UX com loading states
