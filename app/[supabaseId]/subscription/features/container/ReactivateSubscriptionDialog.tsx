"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Minus, Plus, QrCode, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCardForm, type CreditCardFormData } from "@/app/[supabaseId]/manager-users/features/container/CreditCardForm";
import Image from "next/image";

interface ReactivateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOperatorCount: number;
  supabaseId: string;
  onReactivationSuccess: () => void;
}

export function ReactivateSubscriptionDialog({
  open,
  onOpenChange,
  currentOperatorCount,
  supabaseId,
  onReactivationSuccess
}: ReactivateSubscriptionDialogProps) {
  const [operatorCount, setOperatorCount] = useState(currentOperatorCount);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("CREDIT_CARD");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [managerData, setManagerData] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  
  // Dados do formulário de cartão de crédito
  const [creditCardFormData, setCreditCardFormData] = useState<CreditCardFormData | null>(null);
  const [isCreditCardFormValid, setIsCreditCardFormValid] = useState(false);

  // Estados para PIX
  const [paymentData, setPaymentData] = useState<{
    paymentId: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
  } | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'confirmed' | 'failed'>('idle');

  // Calcular valores
  const BASE_PRICE = 59.90;
  const OPERATOR_PRICE = 19.90;
  const totalValue = BASE_PRICE + (OPERATOR_PRICE * operatorCount);

  // Buscar dados do manager quando abrir o dialog
  useEffect(() => {
    if (open && supabaseId) {
      setLoadingProfile(true);
      fetch(`/api/v1/profiles/${supabaseId}`)
        .then(res => res.json())
        .then(result => {
          if (result.isValid && result.result) {
            setManagerData({
              id: result.result.id,
              name: result.result.name,
              email: result.result.email
            });
          }
        })
        .catch(error => {
          console.error('Erro ao buscar profile:', error);
          toast.error('Erro ao carregar dados do perfil');
        })
        .finally(() => {
          setLoadingProfile(false);
        });
    }
  }, [open, supabaseId]);

  // Resetar estado quando fechar
  useEffect(() => {
    if (!open) {
      setOperatorCount(currentOperatorCount);
      setPaymentMethod("CREDIT_CARD");
      setCreditCardFormData(null);
      setIsCreditCardFormValid(false);
      setPaymentData(null);
      setPollingStatus('idle');
    } else {
      setOperatorCount(currentOperatorCount);
    }
  }, [open, currentOperatorCount]);

  // Polling para verificar status do pagamento PIX
  useEffect(() => {
    if (pollingStatus !== 'polling' || !paymentData?.paymentId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/subscriptions/payment-status/${paymentData.paymentId}`);
        const result = await response.json();

        if (result.isValid && result.result) {
          const status = result.result.status;

          if (status === 'CONFIRMED' || status === 'RECEIVED') {
            setPollingStatus('confirmed');
            toast.success('Pagamento confirmado!');
            onReactivationSuccess();
            setTimeout(() => {
              onOpenChange(false);
            }, 2000);
          } else if (status === 'OVERDUE' || status === 'REFUNDED') {
            setPollingStatus('failed');
            toast.error('Pagamento não foi confirmado');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [pollingStatus, paymentData, onReactivationSuccess, onOpenChange]);

  const handleReactivate = async () => {
    if (!managerData) {
      toast.error('Dados do perfil não carregados');
      return;
    }

    if (paymentMethod === 'CREDIT_CARD') {
      if (!isCreditCardFormValid || !creditCardFormData) {
        toast.error('Preencha todos os campos obrigatórios do cartão de crédito');
        return;
      }
    }

    setLoading(true);
    try {
      // Criar nova assinatura do manager
      const payload: any = {
        supabaseId,
        operatorCount,
        paymentMethod
      };

      if (paymentMethod === 'CREDIT_CARD' && creditCardFormData) {
        payload.creditCard = {
          holderName: creditCardFormData.holderName,
          number: creditCardFormData.number,
          expiryMonth: creditCardFormData.expiryMonth,
          expiryYear: creditCardFormData.expiryYear,
          ccv: creditCardFormData.ccv
        };
        payload.creditCardHolderInfo = {
          name: creditCardFormData.name,
          email: managerData.email,
          cpfCnpj: creditCardFormData.cpfCnpj,
          postalCode: creditCardFormData.postalCode,
          addressNumber: creditCardFormData.addressNumber,
          phone: creditCardFormData.phone || creditCardFormData.mobilePhone,
          mobilePhone: creditCardFormData.mobilePhone
        };
        payload.remoteIp = '127.0.0.1';
      }

      const response = await fetch('/api/v1/subscriptions/reactivate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      const result = await response.json();
      
      if (result.isValid && result.result) {
        if (paymentMethod === 'PIX') {
          // Armazenar dados do PIX e iniciar polling
          setPaymentData({
            paymentId: result.result.paymentId || result.result.subscriptionId,
            pixQrCode: result.result.pixQrCode,
            pixCopyPaste: result.result.pixCopyPaste
          });
          setPollingStatus('polling');
          toast.success('QR Code gerado! Aguardando pagamento...');
        } else {
          // Cartão de crédito - confirmação imediata
          toast.success('Assinatura reativada com sucesso!');
          onReactivationSuccess();
          setTimeout(() => {
            onOpenChange(false);
          }, 1500);
        }
      } else {
        const errorMsg = result.errorMessages?.join(', ') || 'Erro ao reativar assinatura';
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Erro ao reativar assinatura:', error);
      toast.error('Erro ao reativar assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPixCode = () => {
    if (paymentData?.pixCopyPaste) {
      navigator.clipboard.writeText(paymentData.pixCopyPaste);
      toast.success('Código PIX copiado!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reativar Assinatura</DialogTitle>
          <DialogDescription>
            Configure sua assinatura e complete o pagamento para reativar
          </DialogDescription>
        </DialogHeader>

        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !managerData ? (
          <div className="text-center py-8 text-muted-foreground">
            Erro ao carregar dados do perfil
          </div>
        ) : (
          <div className="space-y-6">
          {/* Seleção de operadores */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Quantos operadores você deseja?</h3>
              
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base">Número de Operadores</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOperatorCount(Math.max(0, operatorCount - 1))}
                    disabled={operatorCount <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="w-16 text-center">
                    <span className="text-2xl font-bold">{operatorCount}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOperatorCount(operatorCount + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-sm space-y-2 text-muted-foreground border-t pt-4">
                <div className="flex justify-between">
                  <span>Plano Manager Base:</span>
                  <span className="font-medium text-foreground">
                    R$ {BASE_PRICE.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                {operatorCount > 0 && (
                  <div className="flex justify-between">
                    <span>{operatorCount} Operador{operatorCount > 1 ? 'es' : ''} × R$ {OPERATOR_PRICE.toFixed(2).replace('.', ',')}:</span>
                    <span className="font-medium text-foreground">
                      R$ {(OPERATOR_PRICE * operatorCount).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-semibold">Valor Total Mensal:</span>
                  <span className="font-semibold text-foreground text-lg">
                    R$ {totalValue.toFixed(2).replace('.', ',')}/mês
                  </span>
                </div>
              </div>

              {currentOperatorCount > operatorCount && (
                <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                  ⚠️ <strong>Atenção:</strong> Você está reduzindo de {currentOperatorCount} para {operatorCount} operador{operatorCount !== 1 ? 'es' : ''}. 
                  Os operadores excedentes serão desativados.
                </div>
              )}

              {operatorCount > currentOperatorCount && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  ℹ️ Você está aumentando para {operatorCount} operador{operatorCount !== 1 ? 'es' : ''}. 
                  Você poderá adicionar os novos operadores após a reativação.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Método de pagamento */}
          {!paymentData && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Método de Pagamento</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v: string) => setPaymentMethod(v as "PIX" | "CREDIT_CARD")}>
                <Card className={paymentMethod === 'PIX' ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="PIX" id="pix" className="mt-1" />
                      <Label htmlFor="pix" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <QrCode className="h-5 w-5" />
                          <span className="font-semibold">PIX</span>
                          <Badge variant="secondary" className="text-xs">Pagamento Manual</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Pague via QR Code ou Copia e Cola • Confirmação em até 5 minutos
                        </p>
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <Card className={paymentMethod === 'CREDIT_CARD' ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="CREDIT_CARD" id="card" className="mt-1" />
                      <Label htmlFor="card" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="h-5 w-5" />
                          <span className="font-semibold">Cartão de Crédito</span>
                          <Badge variant="secondary" className="text-xs">Reativação Imediata</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Processamento imediato • Assinatura recorrente mensal
                        </p>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>
          )}

          {/* Formulário de Cartão de Crédito */}
          {!paymentData && paymentMethod === 'CREDIT_CARD' && (
            <CreditCardForm
              initialData={{
                name: managerData.name,
              }}
              onFormChange={(data, isValid) => {
                setCreditCardFormData(data);
                setIsCreditCardFormValid(isValid);
              }}
            />
          )}

          {/* Display PIX QR Code */}
          {paymentData && paymentMethod === 'PIX' && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {pollingStatus === 'polling' && (
                  <>
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        {paymentData.pixQrCode && (
                          <Image
                            src={paymentData.pixQrCode}
                            alt="QR Code PIX"
                            width={200}
                            height={200}
                            className="border rounded-lg"
                          />
                        )}
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Código PIX Copia e Cola</Label>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            readOnly
                            value={paymentData.pixCopyPaste || ''}
                            className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCopyPixCode}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Aguardando pagamento...</span>
                      </div>
                    </div>
                  </>
                )}

                {pollingStatus === 'confirmed' && (
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Pagamento Confirmado!</h3>
                      <p className="text-sm text-muted-foreground">
                        Sua assinatura foi reativada com sucesso
                      </p>
                    </div>
                  </div>
                )}

                {pollingStatus === 'failed' && (
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <XCircle className="h-16 w-16 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Pagamento Não Confirmado</h3>
                      <p className="text-sm text-muted-foreground">
                        O pagamento não foi confirmado. Tente novamente.
                      </p>
                    </div>
                    <Button onClick={() => {
                      setPaymentData(null);
                      setPollingStatus('idle');
                    }}>
                      Tentar Novamente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botão de reativar */}
          {!paymentData && (
            <div className="space-y-3">
              <Button 
                onClick={handleReactivate} 
                disabled={
                  loading || 
                  (paymentMethod === 'CREDIT_CARD' && !isCreditCardFormValid)
                } 
                className="w-full h-11"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {paymentMethod === 'PIX' ? 'Gerar QR Code PIX' : 'Reativar Assinatura'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao reativar, sua assinatura anterior será cancelada e uma nova será criada
                com os parâmetros selecionados. 
                {paymentMethod === 'CREDIT_CARD' ? ' A primeira cobrança será processada imediatamente.' : ' Após o pagamento do PIX, sua assinatura será ativada.'}
              </p>
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
