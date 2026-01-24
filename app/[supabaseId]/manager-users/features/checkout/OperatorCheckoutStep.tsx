"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signUpCheckoutSchema, type SignUpCheckoutFormData } from "@/lib/validations/checkoutSchema";
import { toast } from "sonner";
import type { CreateManagerUserFormData } from "../types";

const OPERATOR_PRICE = 19.9;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCardNumber = (value: string) =>
  value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();

const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const getCountdown = (deadline?: number | null) => {
  if (!deadline) return null;
  const diff = deadline - Date.now();
  if (diff <= 0) return "00:00";
  const minutes = Math.floor(diff / 1000 / 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

interface OperatorCheckoutStepProps {
  managerId: string;
  operatorData: CreateManagerUserFormData;
  onCancel: () => void;
  onComplete: () => void;
}

export function OperatorCheckoutStep({
  managerId,
  operatorData,
  onCancel,
  onComplete,
}: OperatorCheckoutStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pendingOperatorId, setPendingOperatorId] = useState<string | null>(null);
  const [paymentDeadline, setPaymentDeadline] = useState<number | null>(null);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [pixData, setPixData] = useState<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null>(null);
  const [boletoData, setBoletoData] = useState<{
    bankSlipUrl: string;
    identificationField: string;
    barCode: string;
    dueDate: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  const form = useForm<SignUpCheckoutFormData>({
    resolver: zodResolver(signUpCheckoutSchema),
    defaultValues: {
      billingType: "PIX",
    },
  });

  const billingType = form.watch("billingType");
  const handleError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSecureContext(window.isSecureContext);
    }
  }, []);

  useEffect(() => {
    if (!paymentDeadline) {
      setPaymentDeadline(Date.now() + PAYMENT_WINDOW_MS);
    }
  }, [paymentDeadline]);

  useEffect(() => {
    if (!paymentDeadline) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      setCountdown(getCountdown(paymentDeadline));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [paymentDeadline]);

  const confirmOperatorCreation = async () => {
    if (!paymentId) return;
    const response = await fetch("/api/v1/operators/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    const result = await response.json();
    if (!response.ok || !result.isValid) {
      throw new Error(result.errorMessages?.join(", ") || "Erro ao confirmar pagamento.");
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentId) {
      handleError("Pagamento nao encontrado. Gere o pagamento novamente.");
      return;
    }

    try {
      const response = await fetch(`/api/v1/operators/payment-status/${paymentId}`);
      const result = await response.json();
      if (!response.ok || !result.isValid) {
        throw new Error(result.errorMessages?.join(", ") || "Erro ao verificar pagamento.");
      }

      const status = result.result?.paymentStatus || result.result?.status;
      if (status === "CONFIRMED" || status === "RECEIVED") {
        await confirmOperatorCreation();
        toast.success("Pagamento confirmado!", {
          description: "Operador criado com sucesso.",
        });
        onComplete();
        return;
      }

      toast.info("Pagamento pendente", {
        description: "Aguardando confirmacao do pagamento.",
      });
    } catch (err) {
      console.error(err);
      toast.error("Nao foi possivel validar o pagamento.");
    }
  };

  useEffect(() => {
    if (!paymentId) return;
    const interval = setInterval(checkPaymentStatus, 3000);
    return () => clearInterval(interval);
  }, [paymentId]);

  const handleCopy = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Codigo copiado!");
    } catch (copyError) {
      console.error(copyError);
      toast.error("Nao foi possivel copiar o codigo.");
    }
  };

  const handleCancelPayment = async () => {
    if (pendingOperatorId) {
      try {
        await fetch(`/api/v1/operators/pending/${pendingOperatorId}`, { method: "DELETE" });
      } catch (err) {
        console.error(err);
        toast.error("Nao foi possivel cancelar o pagamento.");
      }
    }
    toast.info("Pagamento cancelado", {
      description: "Voltando ao gerenciamento de operadores.",
    });
    onCancel();
  };

  const handleSubmit = async (data: SignUpCheckoutFormData) => {
    const isPix = data.billingType === "PIX";
    const isBoleto = data.billingType === "BOLETO";
    const hasPaymentData = (isPix && !!pixData) || (isBoleto && !!boletoData);

    if (hasPaymentData) {
      await checkPaymentStatus();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setPixData(null);
    setBoletoData(null);

    try {
      const payload: any = {
        managerId,
        operatorData: {
          name: operatorData.name,
          email: operatorData.email,
          role: operatorData.role || "operator",
          functions: operatorData.functions,
        },
        billingType: data.billingType,
      };

      if (data.billingType === "CREDIT_CARD") {
        payload.creditCard = {
          holderName: data.creditCard?.holderName,
          number: data.creditCard?.number,
          expiryMonth: data.creditCard?.expiryMonth,
          expiryYear: data.creditCard?.expiryYear,
          ccv: data.creditCard?.ccv,
        };
      }

      const response = await fetch("/api/v1/operators/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result?.isValid) {
        const message =
          result?.errorMessages?.join(", ") || "Nao foi possivel gerar o pagamento.";
        handleError(message);
        return;
      }

      const dataResult = result.result || {};
      setPendingOperatorId(dataResult.pendingOperatorId || null);
      setPaymentId(dataResult.paymentId || null);
      setPixData(dataResult.pix || null);
      setBoletoData(dataResult.boleto || null);
      setPaymentDeadline(Date.now() + PAYMENT_WINDOW_MS);

      if (data.billingType === "CREDIT_CARD") {
        toast.success("Cartao validado. Aguardando confirmacao.");
      }
    } catch (err) {
      console.error(err);
      handleError("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-svh bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" className="w-fit px-0" onClick={handleCancelPayment}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao gerenciamento
          </Button>
          {paymentDeadline && (
            <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3 text-foreground shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm font-semibold tracking-wide text-foreground">{countdown}</div>
              <div className="text-xs text-muted-foreground">
                Tempo limite para conclusao do pagamento
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Finalizar pagamento</h1>
          <p className="text-sm text-muted-foreground">
            Escolha a forma de pagamento para ativar o novo operador.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Dados de pagamento</CardTitle>
              <CardDescription>Finalize seu pedido com seguranca.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit, (errors) => {
                    const firstError = Object.values(errors)[0];
                    const message = firstError?.message || "Verifique os campos obrigatorios.";
                    toast.error(message);
                  })}
                  className="space-y-6"
                >
                  <Tabs
                    value={billingType}
                    onValueChange={(value) => {
                      const nextValue = value as SignUpCheckoutFormData["billingType"];
                      form.setValue("billingType", nextValue);
                      if (nextValue !== "CREDIT_CARD") {
                        form.setValue("creditCard", undefined, { shouldValidate: false });
                      } else if (!form.getValues("creditCard")) {
                        form.setValue("creditCard", {
                          holderName: "",
                          number: "",
                          expiryMonth: "",
                          expiryYear: "",
                          ccv: "",
                        });
                      }
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="PIX" className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        Pix
                      </TabsTrigger>
                      <TabsTrigger value="CREDIT_CARD" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Cartao
                      </TabsTrigger>
                      <TabsTrigger value="BOLETO" className="flex items-center gap-2">
                        <Barcode className="h-4 w-4" />
                        Boleto
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="PIX" className="mt-6 space-y-4">
                      {pixData ? (
                        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
                          <div className="rounded-lg border bg-white p-4 shadow-sm">
                            <img
                              src={`data:image/png;base64,${pixData.encodedImage}`}
                              alt="QR Code Pix"
                              className="h-40 w-40"
                            />
                          </div>
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-base font-semibold">
                                Realize o pagamento via Pix
                              </h3>
                              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                                <li>1. Abra o app do seu banco e selecione Pix.</li>
                                <li>2. Escaneie o QR Code ou copie o codigo abaixo.</li>
                                <li>3. Aguarde a confirmacao do pagamento.</li>
                              </ol>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Codigo Pix</p>
                              <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                                <code className="text-xs break-all">{pixData.payload}</code>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleCopy(pixData.payload)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          Gere o pagamento para exibir o QR Code.
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="CREDIT_CARD" className="mt-6 space-y-4">
                      <>
                        <FormField
                          control={form.control}
                          name="creditCard.holderName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome no cartao</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Nome impresso no cartao"
                                  autoComplete={isSecureContext ? "cc-name" : "off"}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="creditCard.number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Numero do cartao</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="0000 0000 0000 0000"
                                  inputMode="numeric"
                                  autoComplete={isSecureContext ? "cc-number" : "off"}
                                  value={formatCardNumber(field.value || "")}
                                  onChange={(event) =>
                                    field.onChange(event.target.value.replace(/\D/g, ""))
                                  }
                                  maxLength={19}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="creditCard.expiryMonth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mes</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="MM"
                                    inputMode="numeric"
                                    autoComplete={isSecureContext ? "cc-exp-month" : "off"}
                                    maxLength={2}
                                    value={field.value || ""}
                                    onChange={(event) =>
                                      field.onChange(event.target.value.replace(/\D/g, ""))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="creditCard.expiryYear"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ano</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="YYYY"
                                    inputMode="numeric"
                                    autoComplete={isSecureContext ? "cc-exp-year" : "off"}
                                    maxLength={4}
                                    value={field.value || ""}
                                    onChange={(event) =>
                                      field.onChange(event.target.value.replace(/\D/g, ""))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="creditCard.ccv"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CVV</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="000"
                                    inputMode="numeric"
                                    autoComplete={isSecureContext ? "cc-csc" : "off"}
                                    maxLength={4}
                                    value={field.value || ""}
                                    onChange={(event) =>
                                      field.onChange(event.target.value.replace(/\D/g, ""))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        {!isSecureContext && (
                          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                            O preenchimento automatico de cartoes fica disponivel apenas em conexao segura (HTTPS).
                          </div>
                        )}
                      </>
                    </TabsContent>

                    <TabsContent value="BOLETO" className="mt-6 space-y-4">
                      {boletoData ? (
                        <div className="space-y-4 rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <Barcode className="h-6 w-6 text-primary" />
                            <div>
                              <p className="text-sm font-medium">Boleto gerado</p>
                              <p className="text-xs text-muted-foreground">
                                Vencimento: {new Date(boletoData.dueDate).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Linha digitavel</p>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                              <code className="text-xs break-all">{boletoData.identificationField}</code>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleCopy(boletoData.identificationField)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              type="button"
                              className="w-full"
                              onClick={() => window.open(boletoData.bankSlipUrl, "_blank")}
                            >
                              Visualizar boleto
                            </Button>
                            <Button type="button" variant="outline" className="w-full" asChild>
                              <a href={boletoData.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                                Baixar PDF
                              </a>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          Gere o boleto para visualizar a linha digitavel.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {error && (
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Processando..."
                      : billingType === "PIX"
                        ? pixData
                          ? "Validar pagamento"
                          : "Gerar codigo Pix"
                        : billingType === "BOLETO"
                          ? boletoData
                            ? "Validar pagamento"
                            : "Gerar boleto"
                          : `Pagar ${formatCurrency(OPERATOR_PRICE)}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleCancelPayment}
                    disabled={isSubmitting}
                  >
                    Cancelar pagamento
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(OPERATOR_PRICE)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(OPERATOR_PRICE)}</span>
                  </div>
                </div>

                <div className="border-t pt-5 space-y-4">
                  <p className="text-sm font-semibold text-foreground">Informacoes da assinatura</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Recorrencia</span>
                    <span className="text-foreground font-medium">Mensal</span>
                  </div>
                </div>

                <div className="border-t pt-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Itens deste pedido</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-foreground">
                      <span className="text-xs text-muted-foreground">01</span>
                      <span className="font-medium">Licenca Operador</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Acesso completo a plataforma - {operatorData.email}.
                    </p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(OPERATOR_PRICE)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Pagamento intermediado com seguranca pelo Asaas.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
