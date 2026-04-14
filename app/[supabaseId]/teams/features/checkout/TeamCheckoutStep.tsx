"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const getCountdown = (deadline?: number | null) => {
  if (!deadline) return null;
  const diff = deadline - Date.now();
  if (diff <= 0) return "00:00";
  const minutes = Math.floor(diff / 1000 / 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

interface TeamCheckoutStepProps {
  supabaseId: string;
  teamName: string;
  amount: number;
  onCancel: () => void;
  onComplete: () => void;
}

export function TeamCheckoutStep({
  supabaseId,
  teamName,
  amount,
  onCancel,
  onComplete,
}: TeamCheckoutStepProps) {
  const [isCreatingPayment, setIsCreatingPayment] = useState(true);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("PENDING");
  const [billingType, setBillingType] = useState<string | null>(null);
  const [paymentDeadline, setPaymentDeadline] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [currentAmount, setCurrentAmount] = useState(amount);
  const [pixData, setPixData] = useState<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null>(null);
  const [boletoData, setBoletoData] = useState<{
    bankSlipUrl: string | null;
    identificationField: string;
    barCode: string;
    dueDate: string | null;
  } | null>(null);
  const generationStartedRef = useRef(false);
  const completionHandledRef = useRef(false);

  const handleCopy = useCallback(async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código copiado.");
    } catch (copyError) {
      console.error(copyError);
      toast.error("Não foi possível copiar o código.");
    }
  }, []);

  const confirmTeamCreation = useCallback(async () => {
    if (!paymentId || completionHandledRef.current) {
      return;
    }

    completionHandledRef.current = true;

    const response = await fetch("/api/v1/teams/confirm-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
      },
      body: JSON.stringify({ paymentId }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok && !(result?.isValid || result?.successMessages?.includes("Ação já aplicada"))) {
      completionHandledRef.current = false;
      throw new Error(result?.errorMessages?.join(", ") || "Erro ao confirmar pagamento.");
    }
  }, [paymentId, supabaseId]);

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId || completionHandledRef.current) {
      return;
    }

    setIsCheckingPayment(true);

    try {
      const response = await fetch(`/api/v1/teams/payment-status/${paymentId}`);
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao verificar pagamento.");
      }

      const status = result?.result?.paymentStatus || result?.result?.status || "PENDING";
      setPaymentStatus(status);

      if (["CONFIRMED", "RECEIVED", "APPROVED", "RECEIVED_IN_CASH"].includes(status)) {
        await confirmTeamCreation();
        toast.success("Pagamento confirmado!", {
          description: "O time foi criado com sucesso.",
        });
        onComplete();
      }
    } catch (statusError: any) {
      console.error(statusError);
      setError(statusError?.message || "Erro ao verificar pagamento.");
    } finally {
      setIsCheckingPayment(false);
    }
  }, [confirmTeamCreation, onComplete, paymentId]);

  const createPayment = useCallback(async () => {
    setIsCreatingPayment(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/teams/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ name: teamName }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível gerar a cobrança.");
      }

      const payload = result.result || {};
      setPendingActionId(payload.pendingActionId || null);
      setPaymentId(payload.paymentId || null);
      setPaymentStatus(payload.paymentStatus || "PENDING");
      setBillingType(payload.billingType || null);
      setPixData(payload.pix || null);
      setBoletoData(payload.boleto || null);
      setCurrentAmount(typeof payload.amount === "number" ? payload.amount : amount);
      setPaymentDeadline(Date.now() + PAYMENT_WINDOW_MS);

      if (payload.billingType === "CREDIT_CARD") {
        toast.success("Cobrança enviada ao cartão da assinatura.");
      }
    } catch (creationError: any) {
      console.error(creationError);
      setError(creationError?.message || "Erro ao gerar a cobrança.");
    } finally {
      setIsCreatingPayment(false);
    }
  }, [amount, supabaseId, teamName]);

  const handleCancelPayment = useCallback(async () => {
    if (pendingActionId) {
      try {
        await fetch(`/api/v1/teams/pending-actions/${pendingActionId}`, {
          method: "DELETE",
          headers: { "x-supabase-user-id": supabaseId },
        });
      } catch (cancelError) {
        console.error(cancelError);
      }
    }

    onCancel();
  }, [onCancel, pendingActionId, supabaseId]);

  useEffect(() => {
    if (generationStartedRef.current) {
      return;
    }

    generationStartedRef.current = true;
    void createPayment();
  }, [createPayment]);

  useEffect(() => {
    if (!paymentDeadline) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => setCountdown(getCountdown(paymentDeadline));
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [paymentDeadline]);

  useEffect(() => {
    if (!paymentId || completionHandledRef.current) {
      return;
    }

    const interval = setInterval(() => {
      void checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkPaymentStatus, paymentId]);

  return (
    <main className="min-h-svh bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" className="w-fit px-0" onClick={handleCancelPayment}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao gerenciamento
          </Button>
          {paymentDeadline ? (
            <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3 text-foreground shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm font-semibold tracking-wide text-foreground">{countdown}</div>
              <div className="text-xs text-muted-foreground">
                Tempo limite para processar a cobrança atual
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Cobrança incremental do novo time</h1>
          <p className="text-sm text-muted-foreground">
            O valor adicional será cobrado usando a forma de pagamento já vinculada à assinatura da conta.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Status da cobrança</CardTitle>
              <CardDescription>
                {isCreatingPayment
                  ? "Gerando cobrança incremental..."
                  : "Acompanhe a confirmação do pagamento abaixo."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      Valor adicional: {formatCurrency(currentAmount)}
                    </p>
                  </div>
                  <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {billingType || "processando"}
                  </div>
                </div>
              </div>

              {isCreatingPayment ? (
                <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                  Preparando a cobrança com base na assinatura atual da conta.
                </div>
              ) : null}

              {billingType === "CREDIT_CARD" ? (
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cobrança enviada ao cartão do master</p>
                      <p className="text-sm text-muted-foreground">
                        O time será criado automaticamente após a confirmação do pagamento.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {billingType === "PIX" && pixData ? (
                <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <QrCode className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Pagamento via PIX</p>
                      <p className="text-sm text-muted-foreground">
                        Use o QR Code ou copie o código para concluir a cobrança.
                      </p>
                    </div>
                  </div>

                  {pixData.encodedImage ? (
                    <div className="flex justify-center rounded-xl border border-border/60 bg-white p-4">
                      <img
                        src={`data:image/png;base64,${pixData.encodedImage}`}
                        alt="QR Code PIX"
                        className="h-56 w-56"
                      />
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">PIX copia e cola</p>
                    <p className="break-all text-sm text-foreground">{pixData.payload}</p>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => handleCopy(pixData.payload)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código PIX
                  </Button>
                </div>
              ) : null}

              {billingType === "BOLETO" && boletoData ? (
                <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Barcode className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Pagamento via boleto</p>
                      <p className="text-sm text-muted-foreground">
                        O time será criado após a quitação e confirmação do boleto.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Linha digitável</p>
                    <p className="break-all text-sm text-foreground">{boletoData.identificationField}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" onClick={() => handleCopy(boletoData.identificationField)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar linha digitável
                    </Button>
                    {boletoData.bankSlipUrl ? (
                      <Button asChild>
                        <a href={boletoData.bankSlipUrl} target="_blank" rel="noreferrer">
                          Abrir boleto
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => void checkPaymentStatus()} disabled={!paymentId || isCheckingPayment}>
                  {isCheckingPayment ? "Verificando..." : "Verificar pagamento"}
                </Button>
                <Button variant="ghost" onClick={handleCancelPayment}>
                  Cancelar cobrança
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
              <CardDescription>O time só será criado após a confirmação do pagamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status atual</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {paymentStatus || "PENDING"}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">ID do pagamento</p>
                <p className="mt-2 break-all text-sm text-foreground">{paymentId || "Gerando..."}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Observação</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Após a confirmação, a assinatura recorrente da conta será atualizada para refletir o novo total mensal.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
