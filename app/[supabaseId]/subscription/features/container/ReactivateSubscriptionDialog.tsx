"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CreditCard, Minus, Plus, QrCode, CheckCircle2, XCircle, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCardForm, type CreditCardFormData } from "@/app/[supabaseId]/manager-users/features/container/CreditCardForm";
import Image from "next/image";
import { API_CLIENT_BASE } from "@/lib/route-map";
import { cn } from "@/lib/utils";
import { classifyPaymentStatus } from "@/lib/billing/payment-status-vocabulary";
import {
  buildReactivationPayload,
  extractPixPaymentId,
  shouldPreservePaymentOnClose,
} from "../utils/reactivate-subscription";

interface ReactivateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOperatorCount: number;
  supabaseId: string;
  onReactivationSuccess: () => void;
}

type ManagerData = { id: string; name: string; email: string };
type PaymentData = { paymentId: string; pixQrCode?: string; pixCopyPaste?: string };
type PollingStatus = "idle" | "polling" | "confirmed" | "failed" | "timeout";

// E3: ~10 minutos de espera (5s por tentativa) antes de assumir um estado
// terminal — nenhum polling PIX fica esperando para sempre.
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

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
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [managerData, setManagerData] = useState<ManagerData | null>(null);

  // Dados do formulário de cartão de crédito
  const [creditCardFormData, setCreditCardFormData] = useState<CreditCardFormData | null>(null);
  const [isCreditCardFormValid, setIsCreditCardFormValid] = useState(false);

  // Estados para PIX
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>("idle");
  const [pollTransientError, setPollTransientError] = useState(false);
  const pollAttemptsRef = useRef(0);

  // Calcular valores
  const BASE_PRICE = 59.90;
  const OPERATOR_PRICE = 19.90;
  const totalValue = BASE_PRICE + (OPERATOR_PRICE * operatorCount);

  const loadManagerProfile = useCallback(async () => {
    setLoadingProfile(true);
    setProfileLoadFailed(false);
    try {
      const res = await fetch(`${API_CLIENT_BASE}/profiles/${supabaseId}`);
      const result = await res.json();
      if (result.isValid && result.result) {
        setManagerData({
          id: result.result.id,
          name: result.result.name,
          email: result.result.email
        });
      } else {
        setProfileLoadFailed(true);
      }
    } catch (error) {
      console.error('Erro ao buscar profile:', error);
      setProfileLoadFailed(true);
    } finally {
      setLoadingProfile(false);
    }
  }, [supabaseId]);

  // Buscar dados do manager quando abrir o dialog
  useEffect(() => {
    if (open && supabaseId) {
      void loadManagerProfile();
    }
  }, [open, supabaseId, loadManagerProfile]);

  // Resetar estado quando fechar.
  //
  // Achado P1 da revisão do PR #1207 (thread PRRT_...fFck): fechar o diálogo
  // NÃO pode descartar uma cobrança pendente. `showSubmitFooter` depende de
  // `!paymentData`, então zerar o pagamento aqui fazia a reabertura mostrar
  // o formulário de submit de novo — e o próximo submit chama
  // `POST /subscriptions/reactivate`, que cancela a assinatura recém-criada
  // e abre OUTRA cobrança, enquanto o primeiro QR Code segue pagável. É a
  // mesma dupla cobrança que o CTA de timeout já tinha causado, por outra
  // porta: o botão "Fechar" daquele mesmo estado.
  //
  // Enquanto houver cobrança em aberto (existe `paymentData` e o desfecho
  // não é terminal), o estado de pagamento é preservado: reabrir mostra o
  // QR Code e o "Verificar novamente", nunca o submit. Desfecho terminal
  // (`confirmed`, que já fecha sozinho, ou `failed`) libera o reset.
  const paymentStateRef = useRef({ paymentData, pollingStatus });
  paymentStateRef.current = { paymentData, pollingStatus };

  useEffect(() => {
    if (!open) {
      const { paymentData: pending, pollingStatus: status } = paymentStateRef.current;

      setOperatorCount(currentOperatorCount);
      if (shouldPreservePaymentOnClose({ hasPaymentData: Boolean(pending), pollingStatus: status })) {
        return;
      }

      setPaymentMethod("CREDIT_CARD");
      setCreditCardFormData(null);
      setIsCreditCardFormValid(false);
      setPaymentData(null);
      setPollingStatus('idle');
      setPollTransientError(false);
    } else {
      setOperatorCount(currentOperatorCount);
    }
  }, [open, currentOperatorCount]);

  // Polling para verificar status do pagamento PIX — com timeout (E3): depois
  // de MAX_POLL_ATTEMPTS (~10 min), o estado vira 'timeout' com orientação
  // para a aba Faturas em vez de "Aguardando pagamento..." eterno.
  useEffect(() => {
    if (pollingStatus !== 'polling' || !paymentData?.paymentId) return;

    pollAttemptsRef.current = 0;
    setPollTransientError(false);

    const interval = setInterval(async () => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        setPollingStatus('timeout');
        return;
      }

      try {
        const response = await fetch(`${API_CLIENT_BASE}/subscriptions/payment-status/${paymentData.paymentId}`);
        const result = await response.json();

        if (result.isValid && result.result) {
          setPollTransientError(false);
          // Classificação pelo vocabulário compartilhado (SPEC 41 E2,
          // `lib/billing/payment-status-vocabulary`) em vez de dois conjuntos
          // literais locais: o par CONFIRMED/RECEIVED perdia
          // RECEIVED_IN_CASH/APPROVED, e o par OVERDUE/REFUNDED perdia REFUSED,
          // CANCELLED/CANCELED, CHARGEBACK_*, REFUND_REQUESTED e FAILED — um PIX
          // recusado caía em "em trânsito" e girava os ~10 min até o timeout.
          const outcome = classifyPaymentStatus(result.result.status);

          if (outcome === 'paid') {
            setPollingStatus('confirmed');
            toast.success('Pagamento confirmado!');
            onReactivationSuccess();
            setTimeout(() => {
              onOpenChange(false);
            }, 2000);
          } else if (outcome === 'failed') {
            setPollingStatus('failed');
            toast.error('Pagamento não foi confirmado');
          }
        }
      } catch (error) {
        // E3: o catch não é mais silencioso — vira um aviso visível inline
        // (sem spam de toast a cada 5s) enquanto o polling continua tentando
        // até o timeout.
        console.error('Erro ao verificar status:', error);
        setPollTransientError(true);
      }
    }, POLL_INTERVAL_MS);

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
      // Criar nova assinatura do manager. E3: `buildReactivationPayload`
      // nunca inclui `remoteIp` forjado — dado falso enviado ao antifraude
      // de cartão (removido; o backend captura o IP real do request).
      const payload = buildReactivationPayload({
        supabaseId,
        operatorCount,
        paymentMethod,
        managerEmail: managerData.email,
        creditCardFormData,
      });

      const response = await fetch(`${API_CLIENT_BASE}/subscriptions/reactivate`, {
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
          const paymentId = extractPixPaymentId(result.result);
          if (!paymentId) {
            // E3: sem fallback para `subscriptionId` — consultar
            // `/subscriptions/payment-status/{id}` com um id que não é de
            // pagamento nunca confirma, mesmo com o PIX pago.
            toast.error('Não recebemos o identificador do pagamento PIX. Tente novamente.');
            return;
          }
          setPaymentData({
            paymentId,
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

  const showSubmitFooter = !loadingProfile && !profileLoadFailed && managerData && !paymentData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Reativar Assinatura</DialogTitle>
          <DialogDescription>
            Configure sua assinatura e complete o pagamento para reativar
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : profileLoadFailed || !managerData ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
              <span>Erro ao carregar dados do perfil</span>
              <Button variant="outline" size="sm" className="max-lg:h-11" onClick={() => void loadManagerProfile()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Seleção de operadores */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-4 font-semibold">Quantos operadores você deseja?</h3>

                  <div className="mb-4 flex items-center justify-between">
                    <Label className="text-base">Número de Operadores</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="max-lg:size-11"
                        aria-label="Diminuir número de operadores"
                        onClick={() => setOperatorCount(Math.max(0, operatorCount - 1))}
                        disabled={operatorCount <= 0}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <div className="w-16 text-center">
                        <span className="text-2xl font-bold">{operatorCount}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="max-lg:size-11"
                        aria-label="Aumentar número de operadores"
                        onClick={() => setOperatorCount(operatorCount + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-4" />
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
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
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="font-semibold">Valor Total Mensal:</span>
                      <span className="text-lg font-semibold text-foreground">
                        R$ {totalValue.toFixed(2).replace('.', ',')}/mês
                      </span>
                    </div>
                  </div>

                  {currentOperatorCount > operatorCount && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-semantic-warning-border bg-semantic-warning-surface p-3 text-sm text-semantic-warning">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <strong>Atenção:</strong> Você está reduzindo de {currentOperatorCount} para {operatorCount} operador{operatorCount !== 1 ? 'es' : ''}.
                        Os operadores excedentes serão desativados.
                      </span>
                    </div>
                  )}

                  {operatorCount > currentOperatorCount && (
                    <div className="mt-4 rounded-lg border border-semantic-info-border bg-semantic-info-surface p-3 text-sm text-semantic-info">
                      Você está aumentando para {operatorCount} operador{operatorCount !== 1 ? 'es' : ''}.
                      Você poderá adicionar os novos operadores após a reativação.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Método de pagamento */}
              {!paymentData && (
                <div className="flex flex-col gap-3">
                  <Label className="text-base font-semibold">Método de Pagamento</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(v: string) => setPaymentMethod(v as "PIX" | "CREDIT_CARD")}>
                    <Card className={cn(paymentMethod === 'PIX' && 'ring-2 ring-primary')}>
                      <CardContent className="flex items-start gap-3 pb-4 pt-4">
                        <RadioGroupItem value="PIX" id="pix" className="mt-1" />
                        <Label htmlFor="pix" className="flex-1 cursor-pointer">
                          <div className="mb-1 flex items-center gap-2">
                            <QrCode className="size-5" />
                            <span className="font-semibold">PIX</span>
                            <Badge variant="secondary" className="text-xs">Pagamento Manual</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Pague via QR Code ou Copia e Cola • Confirmação em até 5 minutos
                          </p>
                        </Label>
                      </CardContent>
                    </Card>

                    <Card className={cn(paymentMethod === 'CREDIT_CARD' && 'ring-2 ring-primary')}>
                      <CardContent className="flex items-start gap-3 pb-4 pt-4">
                        <RadioGroupItem value="CREDIT_CARD" id="card" className="mt-1" />
                        <Label htmlFor="card" className="flex-1 cursor-pointer">
                          <div className="mb-1 flex items-center gap-2">
                            <CreditCard className="size-5" />
                            <span className="font-semibold">Cartão de Crédito</span>
                            <Badge variant="secondary" className="text-xs">Reativação Imediata</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Processamento imediato • Assinatura recorrente mensal
                          </p>
                        </Label>
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
                  <CardContent className="flex flex-col gap-4 pt-6">
                    {pollingStatus === 'polling' && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex justify-center">
                          {paymentData.pixQrCode && (
                            <Image
                              src={paymentData.pixQrCode}
                              alt="QR Code PIX"
                              width={200}
                              height={200}
                              className="rounded-lg border"
                            />
                          )}
                        </div>

                        <div className="w-full">
                          <Label htmlFor="reactivate-pix-copy-paste" className="text-sm font-medium">
                            Código PIX Copia e Cola
                          </Label>
                          <div className="mt-2 flex gap-2">
                            <input
                              id="reactivate-pix-copy-paste"
                              type="text"
                              readOnly
                              value={paymentData.pixCopyPaste || ''}
                              className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="max-lg:size-11"
                              aria-label="Copiar código PIX"
                              onClick={handleCopyPixCode}
                            >
                              <Copy className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                          <span>Aguardando pagamento...</span>
                        </div>

                        {pollTransientError && (
                          <p className="text-xs text-muted-foreground">
                            Não conseguimos verificar o status agora — tentando novamente...
                          </p>
                        )}
                      </div>
                    )}

                    {pollingStatus === 'confirmed' && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex justify-center">
                          <CheckCircle2 className="size-16 text-semantic-success" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Pagamento Confirmado!</h3>
                          <p className="text-sm text-muted-foreground">
                            Sua assinatura foi reativada com sucesso
                          </p>
                        </div>
                      </div>
                    )}

                    {pollingStatus === 'failed' && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex justify-center">
                          <XCircle className="size-16 text-destructive" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Pagamento Não Confirmado</h3>
                          <p className="text-sm text-muted-foreground">
                            O pagamento não foi confirmado. Tente novamente.
                          </p>
                        </div>
                        <Button className="max-lg:h-11" onClick={() => {
                          setPaymentData(null);
                          setPollingStatus('idle');
                        }}>
                          Tentar Novamente
                        </Button>
                      </div>
                    )}

                    {pollingStatus === 'timeout' && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex justify-center">
                          <AlertTriangle className="size-16 text-semantic-warning" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Não conseguimos confirmar ainda</h3>
                          <p className="text-sm text-muted-foreground">
                            O QR Code acima continua válido. Se você já pagou, a confirmação pode
                            chegar depois deste aviso — verifique novamente ou confira em Faturas
                            em alguns minutos.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {/*
                            Achado P1 da revisão do lote unificado (PR #1207, codex + cursor):
                            aqui havia "Gerar novo QR Code", que zerava `paymentData` e devolvia o
                            footer de submit. O próximo submit chama
                            `POST /subscriptions/reactivate`, que **cancela a assinatura recém-criada
                            e abre outra** com nova cobrança PIX — quem pagou o primeiro PIX depois
                            dos ~10 min (ou cujo webhook atrasou) seria cobrado duas vezes. O
                            timeout é falta de confirmação, não desfecho: a cobrança segue
                            pendente. Por isso a saída preserva o `paymentId` e só retoma o poll.
                            Desfecho terminal de verdade cai no estado `failed`, que aí sim libera
                            gerar outra cobrança.
                          */}
                          <Button
                            variant="outline"
                            className="max-lg:h-11"
                            onClick={() => setPollingStatus('polling')}
                          >
                            Verificar novamente
                          </Button>
                          <Button className="max-lg:h-11" onClick={() => onOpenChange(false)}>Fechar</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {showSubmitFooter && (
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:space-x-0">
            <Button
              onClick={handleReactivate}
              disabled={
                loading ||
                (paymentMethod === 'CREDIT_CARD' && !isCreditCardFormValid)
              }
              className="h-11 w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {paymentMethod === 'PIX' ? 'Gerar QR Code PIX' : 'Reativar Assinatura'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Ao reativar, sua assinatura anterior será cancelada e uma nova será criada
              com os parâmetros selecionados.
              {paymentMethod === 'CREDIT_CARD' ? ' A primeira cobrança será processada imediatamente.' : ' Após o pagamento do PIX, sua assinatura será ativada.'}
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
