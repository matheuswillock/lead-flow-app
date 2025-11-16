"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, QrCode, CheckCircle2, XCircle, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { OperatorPaymentData } from "../types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorData: {
    name: string;
    email: string;
    role: string;
  } | null;
  managerId: string;
  onPaymentCreated: (paymentData: OperatorPaymentData) => void;
  onPaymentConfirmed: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  operatorData,
  managerId,
  onPaymentCreated,
  onPaymentConfirmed
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<OperatorPaymentData | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'confirmed' | 'failed'>('idle');

  // Resetar estado quando fechar
  useEffect(() => {
    if (!open) {
      setPaymentData(null);
      setPollingStatus('idle');
      setPaymentMethod("PIX");
    }
  }, [open]);

  // Polling de status do pagamento
  useEffect(() => {
    if (!paymentData?.paymentId || pollingStatus !== 'polling') return;

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/v1/operators/payment-status/${paymentData.paymentId}`);
        const result = await response.json();

        if (result.isValid && result.result) {
          const status = result.result.paymentStatus;
          
          if (status === 'CONFIRMED') {
            setPollingStatus('confirmed');
            toast.success('Pagamento confirmado! Operador criado com sucesso.');
            onPaymentConfirmed();
            setTimeout(() => {
              onOpenChange(false);
            }, 2000);
          } else if (status === 'FAILED') {
            setPollingStatus('failed');
            toast.error('Pagamento falhou. Tente novamente.');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };

    const interval = setInterval(checkPaymentStatus, 5000); // Check a cada 5 segundos

    return () => clearInterval(interval);
  }, [paymentData?.paymentId, pollingStatus, onPaymentConfirmed, onOpenChange]);

  const handleCreatePayment = async () => {
    if (!operatorData) return;

    setLoading(true);
    try {
      const response = await fetch('/api/v1/operators/add-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId,
          operatorData: {
            name: operatorData.name,
            email: operatorData.email,
            role: operatorData.role
          },
          paymentMethod
        })
      });

      const result = await response.json();
      
      if (result.isValid && result.result) {
        setPaymentData(result.result);
        setPollingStatus('polling');
        onPaymentCreated(result.result);
        toast.success('Pagamento criado! Aguardando confirmação...');
      } else {
        toast.error(result.errorMessages?.join(', ') || 'Erro ao criar pagamento');
      }
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      toast.error('Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência!');
  };

  const renderPaymentStatus = () => {
    switch (pollingStatus) {
      case 'polling':
        return (
          <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
            <Clock className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">Aguardando confirmação do pagamento...</span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Pagamento confirmado! Operador criado com sucesso.</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Pagamento falhou. Por favor, tente novamente.</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Adicionar Operador - Pagamento</DialogTitle>
          <DialogDescription>
            Complete o pagamento para adicionar o novo operador
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!paymentData ? (
            <>
              {/* Detalhes do operador */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Detalhes do Operador</h3>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Nome:</span>
                      <span className="font-medium text-foreground">{operatorData?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="font-medium text-foreground">{operatorData?.email}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-semibold">Valor:</span>
                      <span className="font-semibold text-foreground text-lg">R$ 20,00/mês</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Método de pagamento */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Método de Pagamento</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v: string) => setPaymentMethod(v as "PIX" | "CREDIT_CARD")}>
                  <Card className={`cursor-pointer transition-all ${paymentMethod === 'PIX' ? 'ring-2 ring-primary' : ''}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="PIX" id="pix" className="mt-1" />
                        <Label htmlFor="pix" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <QrCode className="h-5 w-5 text-primary" />
                            <span className="font-semibold">PIX</span>
                            <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Aprovação instantânea • QR Code ou Copia e Cola
                          </p>
                        </Label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`cursor-pointer transition-all ${paymentMethod === 'CREDIT_CARD' ? 'ring-2 ring-primary' : ''}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="CREDIT_CARD" id="card" className="mt-1" />
                        <Label htmlFor="card" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="h-5 w-5" />
                            <span className="font-semibold">Cartão de Crédito</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Processamento imediato • Débito em 1x
                          </p>
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                </RadioGroup>
              </div>

              {/* Botão de criar pagamento */}
              <Button 
                onClick={handleCreatePayment} 
                disabled={loading} 
                className="w-full h-11"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar Pagamento
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Status do pagamento */}
              {renderPaymentStatus()}

              {/* Dados do pagamento PIX */}
              {paymentMethod === "PIX" && paymentData.pixCopyPaste && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Código PIX Copia e Cola</Label>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={paymentData.pixCopyPaste}
                          className="flex-1 text-xs p-3 border rounded bg-muted font-mono"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(paymentData.pixCopyPaste!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {paymentData.pixQrCode && (
                      <div className="text-center space-y-2">
                        <Label className="text-sm font-semibold">QR Code</Label>
                        <div className="bg-white p-4 rounded-lg inline-block border">
                          <img 
                            src={paymentData.pixQrCode} 
                            alt="QR Code PIX"
                            className="w-48 h-48 mx-auto"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Escaneie o QR Code com o app do seu banco
                        </p>
                      </div>
                    )}

                    {paymentData.dueDate && (
                      <div className="text-center pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Válido até: {new Date(paymentData.dueDate).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Informação adicional */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {pollingStatus === 'polling' && (
                    <>
                      Após a confirmação do pagamento, o operador será criado <strong>automaticamente</strong>.
                    </>
                  )}
                  {pollingStatus === 'confirmed' && (
                    <>
                      O operador foi criado e receberá um email com as credenciais de acesso.
                    </>
                  )}
                  {pollingStatus === 'failed' && (
                    <>
                      O pagamento não foi confirmado. Por favor, tente novamente ou entre em contato com o suporte.
                    </>
                  )}
                </p>
              </div>

              {pollingStatus !== 'confirmed' && (
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Fechar
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
