"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  QrCode,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { maskCEP, maskCPFOrCNPJ, maskCardNumber, maskPhone, unmask } from "@/lib/masks"
import { usePublicAdhesion } from "../context/PublicAdhesionHook"
import type {
  PublicAdhesionBillingType,
  PublicAdhesionCheckoutInput,
  PublicAdhesionStatusKey,
} from "../context/PublicAdhesionTypes"

const ATTEMPT_DURATION_MS = 25 * 60 * 1000
const ATTEMPT_STORAGE_PREFIX = "public-adhesion-attempt-start:"

function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getAttemptStorageKey(token: string): string {
  return `${ATTEMPT_STORAGE_PREFIX}${token}`
}

function initialForm(detailsFullName = "", detailsPhone = "", detailsEmail = "") {
  return {
    fullName: detailsFullName,
    email: detailsEmail,
    phone: detailsPhone,
    cpfCnpj: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    complement: "",
    city: "",
    state: "",
    billingType: "PIX" as PublicAdhesionBillingType,
    installments: 1,
    cardHolderName: "",
    cardNumber: "",
    cardExpiryMonth: "",
    cardExpiryYear: "",
    cardCcv: "",
  }
}

export function PublicAdhesionContainer() {
  const {
    token,
    details,
    payment,
    isLoading,
    isSubmitting,
    error,
    submitCheckout,
    refreshPaymentStatus,
  } = usePublicAdhesion()
  const [form, setForm] = useState(initialForm())
  const [pendingBillingSwitch, setPendingBillingSwitch] =
    useState<PublicAdhesionBillingType | null>(null)
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [isValidatingPayment, setIsValidatingPayment] = useState(false)
  const previousErrorRef = useRef<string | null>(null)
  const previousStatusRef = useRef<PublicAdhesionStatusKey | null>(null)

  useEffect(() => {
    if (!details) return
    setForm((current) => ({
      ...current,
      fullName: current.fullName || details.fullName,
      phone: current.phone || details.phone,
      email: current.email || details.email || "",
      installments: Math.min(current.installments, details.maxInstallments),
    }))
  }, [details])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem(getAttemptStorageKey(token))
    if (!stored) return
    const parsed = Number(stored)
    if (!Number.isNaN(parsed)) {
      setAttemptStartedAt(parsed)
      setNow(Date.now())
    }
  }, [token])

  useEffect(() => {
    if (typeof window === "undefined" || !payment?.paymentId) return

    const storageKey = getAttemptStorageKey(token)
    const stored = window.sessionStorage.getItem(storageKey)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        setAttemptStartedAt((current) => current ?? parsed)
        return
      }
    }

    const startedAt = Date.now()
    window.sessionStorage.setItem(storageKey, String(startedAt))
    setAttemptStartedAt(startedAt)
    setNow(Date.now())
  }, [payment?.paymentId, token])

  const attemptExpiresAt = attemptStartedAt ? attemptStartedAt + ATTEMPT_DURATION_MS : null
  const attemptRemainingMs =
    attemptExpiresAt !== null ? Math.max(0, attemptExpiresAt - now) : null
  const isAttemptExpired = attemptRemainingMs === 0 && payment?.status !== "paid"
  const isCheckoutLocked = payment?.status === "paid" || isAttemptExpired

  useEffect(() => {
    if (!attemptStartedAt || payment?.status === "paid") return
    setNow(Date.now())
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [attemptStartedAt, payment?.status])

  useEffect(() => {
    if (!payment?.paymentId || payment.status !== "pending" || isAttemptExpired) return
    const timer = window.setInterval(() => {
      void refreshPaymentStatus()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [isAttemptExpired, payment?.paymentId, payment?.status, refreshPaymentStatus])

  useEffect(() => {
    if (error && error !== previousErrorRef.current) {
      toast.error(error)
    }
    previousErrorRef.current = error
  }, [error])

  useEffect(() => {
    const currentStatus = payment?.status ?? null
    const previousStatus = previousStatusRef.current

    if (previousStatus === "pending" && currentStatus === "paid") {
      toast.success("Pagamento confirmado. Verifique seu e-mail.")
    }

    if (
      attemptStartedAt &&
      previousStatus !== "canceled" &&
      currentStatus === "canceled"
    ) {
      toast.error("Pagamento recusado. Reabra o link do e-mail para tentar novamente.")
    }

    previousStatusRef.current = currentStatus
  }, [attemptStartedAt, payment?.status])

  const installmentOptions = useMemo(() => {
    const max = details?.maxInstallments ?? 1
    return Array.from({ length: max }, (_, index) => index + 1)
  }, [details?.maxInstallments])

  const canSubmit =
    Boolean(details) &&
    !isCheckoutLocked &&
    form.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    /^\d{10,11}$/.test(onlyDigits(form.phone, 11)) &&
    (/^\d{11}$/.test(onlyDigits(form.cpfCnpj, 14)) ||
      /^\d{14}$/.test(onlyDigits(form.cpfCnpj, 14))) &&
    /^\d{8}$/.test(onlyDigits(form.postalCode, 8)) &&
    Boolean(form.address.trim()) &&
    Boolean(form.addressNumber.trim()) &&
    Boolean(form.neighborhood.trim()) &&
    Boolean(form.city.trim()) &&
    /^[A-Za-z]{2}$/.test(form.state.trim()) &&
    (form.billingType !== "CREDIT_CARD" ||
      (form.cardHolderName.trim().length >= 2 &&
        onlyDigits(form.cardNumber, 19).length >= 13 &&
        onlyDigits(form.cardExpiryMonth, 2).length === 2 &&
        onlyDigits(form.cardExpiryYear, 4).length >= 2 &&
        onlyDigits(form.cardCcv, 4).length >= 3))

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (!details || !canSubmit || isSubmitting) return

    const payload: PublicAdhesionCheckoutInput = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: onlyDigits(form.phone, 11),
      cpfCnpj: onlyDigits(form.cpfCnpj, 14),
      postalCode: onlyDigits(form.postalCode, 8),
      address: form.address.trim(),
      addressNumber: form.addressNumber.trim(),
      neighborhood: form.neighborhood.trim(),
      complement: form.complement.trim() || null,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      billingType: form.billingType,
      installments: form.billingType === "CREDIT_CARD" ? form.installments : 1,
      creditCard:
        form.billingType === "CREDIT_CARD"
          ? {
              holderName: form.cardHolderName.trim(),
              number: onlyDigits(form.cardNumber, 19),
              expiryMonth: onlyDigits(form.cardExpiryMonth, 2),
              expiryYear: onlyDigits(form.cardExpiryYear, 4),
              ccv: onlyDigits(form.cardCcv, 4),
            }
          : undefined,
    }

    await submitCheckout(payload)
  }

  async function handleValidatePayment() {
    if (
      !payment?.paymentId ||
      payment.status === "paid" ||
      isValidatingPayment ||
      isAttemptExpired
    ) return

    setIsValidatingPayment(true)
    try {
      await refreshPaymentStatus({ sync: true })
    } finally {
      setIsValidatingPayment(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <Skeleton className="h-[560px]" />
            <Skeleton className="h-[360px]" />
          </div>
        </div>
      </main>
    )
  }

  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Alert className="max-w-md">
          <AlertTitle>Adesão indisponível</AlertTitle>
          <AlertDescription>{error ?? "Não foi possível carregar este link."}</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Checkout Corretor Studio</h1>
            <p className="text-sm text-muted-foreground">
              Revise sua adesão e conclua o pagamento.
            </p>
          </div>
          <Badge variant="outline">Plano CRM</Badge>
        </div>

        {attemptStartedAt && payment?.status !== "paid" ? (
          <Card className={isAttemptExpired ? "border-destructive/40" : undefined}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <Clock3 data-icon="inline-start" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">
                    {isAttemptExpired ? "Tentativa expirada" : "Tempo restante da tentativa"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isAttemptExpired
                      ? "Reabra o link enviado por e-mail para iniciar uma nova tentativa."
                      : `Finalize o pagamento em ${formatCountdown(attemptRemainingMs ?? 0)}.`}
                  </p>
                </div>
              </div>
              <Badge variant={isAttemptExpired ? "destructive" : "outline"}>
                {isAttemptExpired ? "Link bloqueado" : formatCountdown(attemptRemainingMs ?? 0)}
              </Badge>
            </CardContent>
          </Card>
        ) : null}

        {payment?.status === "paid" ? (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5" data-icon="inline-start" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Pagamento confirmado. Verifique seu e-mail.</p>
                <p className="text-sm text-muted-foreground">
                  A conta será liberada no endereço informado nesta adesão.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {payment?.status === "canceled" ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5" data-icon="inline-start" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Pagamento recusado</p>
                <p className="text-sm text-muted-foreground">
                  Reabra o link do e-mail para iniciar uma nova tentativa de pagamento.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isAttemptExpired ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5" data-icon="inline-start" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Link expirado</p>
                <p className="text-sm text-muted-foreground">
                  O prazo de pagamento terminou. Reabra o link enviado por e-mail para continuar.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>Dados de cobrança</CardTitle>
              <CardDescription>
                O plano foi definido pelo time comercial e não pode ser alterado neste checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Celular</Label>
                  <Input
                    id="phone"
                    value={maskPhone(form.phone)}
                    onChange={(event) => updateField("phone", unmask(event.target.value).slice(0, 11))}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                  <Input
                    id="cpfCnpj"
                    value={maskCPFOrCNPJ(form.cpfCnpj)}
                    onChange={(event) =>
                      updateField("cpfCnpj", unmask(event.target.value).slice(0, 14))
                    }
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="postalCode">CEP</Label>
                  <Input
                    id="postalCode"
                    value={maskCEP(form.postalCode)}
                    onChange={(event) =>
                      updateField("postalCode", unmask(event.target.value).slice(0, 8))
                    }
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="addressNumber">Número</Label>
                  <Input
                    id="addressNumber"
                    value={form.addressNumber}
                    onChange={(event) => updateField("addressNumber", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(event) => updateField("neighborhood", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(event) =>
                      updateField("state", event.target.value.toUpperCase().slice(0, 2))
                    }
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={form.complement}
                    onChange={(event) => updateField("complement", event.target.value)}
                    disabled={isSubmitting || isCheckoutLocked}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-4">
                <div>
                  <Label>Forma de pagamento</Label>
                  <Tabs
                    value={form.billingType}
                    onValueChange={(value) => {
                      const next = value as PublicAdhesionBillingType
                      if (payment?.paymentId && payment.status !== "paid" && next !== form.billingType) {
                        setPendingBillingSwitch(next)
                      } else {
                        updateField("billingType", next)
                      }
                    }}
                    className="mt-2"
                  >
                    <TabsList>
                      <TabsTrigger value="PIX" disabled={isSubmitting || isCheckoutLocked}>
                        <QrCode data-icon="inline-start" />
                        PIX
                      </TabsTrigger>
                      <TabsTrigger
                        value="CREDIT_CARD"
                        disabled={isSubmitting || isCheckoutLocked}
                      >
                        <CreditCard data-icon="inline-start" />
                        Cartão
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {form.billingType === "CREDIT_CARD" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label htmlFor="cardHolderName">Nome impresso no cartão</Label>
                      <Input
                        id="cardHolderName"
                        value={form.cardHolderName}
                        onChange={(event) => updateField("cardHolderName", event.target.value)}
                        disabled={isSubmitting || isCheckoutLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label htmlFor="cardNumber">Número do cartão</Label>
                      <Input
                        id="cardNumber"
                        value={maskCardNumber(form.cardNumber)}
                        onChange={(event) =>
                          updateField("cardNumber", unmask(event.target.value).slice(0, 19))
                        }
                        disabled={isSubmitting || isCheckoutLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cardExpiryMonth">Mês</Label>
                      <Input
                        id="cardExpiryMonth"
                        value={form.cardExpiryMonth}
                        onChange={(event) =>
                          updateField("cardExpiryMonth", onlyDigits(event.target.value, 2))
                        }
                        disabled={isSubmitting || isCheckoutLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cardExpiryYear">Ano</Label>
                      <Input
                        id="cardExpiryYear"
                        value={form.cardExpiryYear}
                        onChange={(event) =>
                          updateField("cardExpiryYear", onlyDigits(event.target.value, 4))
                        }
                        disabled={isSubmitting || isCheckoutLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cardCcv">CVV</Label>
                      <Input
                        id="cardCcv"
                        value={form.cardCcv}
                        onChange={(event) =>
                          updateField("cardCcv", onlyDigits(event.target.value, 4))
                        }
                        disabled={isSubmitting || isCheckoutLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Parcelas</Label>
                      <Select
                        value={String(form.installments)}
                        onValueChange={(value) =>
                          updateField("installments", Number.parseInt(value, 10))
                        }
                        disabled={isSubmitting || isCheckoutLocked}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {installmentOptions.map((installment) => (
                              <SelectItem key={installment} value={String(installment)}>
                                {installment}x de {formatCurrency(details.totalAmount / installment)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>

              <Button
                type="button"
                size="lg"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : null}
                {form.billingType === "CREDIT_CARD" ? "Realizar pagamento" : "Gerar QR Code Pix"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
                <CardDescription>Plano CRM bloqueado para esta adesão.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ciclo</span>
                  <span className="font-medium">{details.cycleLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mensalidade</span>
                  <span className="font-medium">{formatCurrency(details.monthlyTotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Times adicionais</span>
                  <span className="font-medium">{details.extraTeams}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Usuários adicionais</span>
                  <span className="font-medium">{details.extraUsers}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total antecipado</span>
                  <span className="text-lg font-semibold">{formatCurrency(details.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>

            {payment ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pagamento</CardTitle>
                  <CardDescription>
                    {payment.status === "paid"
                      ? "Pagamento confirmado."
                      : payment.status === "canceled"
                        ? "Pagamento recusado."
                        : "Aguardando confirmação do Asaas."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {form.billingType === "PIX" && payment.status !== "paid" ? (
                    <>
                      {payment.pix?.encodedImage ? (
                        <img
                          src={`data:image/png;base64,${payment.pix.encodedImage}`}
                          alt="QR Code PIX"
                          className="mx-auto size-48 rounded-md border"
                        />
                      ) : null}
                      {payment.pix?.payload ? <Input value={payment.pix.payload} readOnly /> : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleValidatePayment}
                        disabled={isValidatingPayment || !payment.paymentId || isAttemptExpired}
                      >
                        {isValidatingPayment ? (
                          <RefreshCw data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <RefreshCw data-icon="inline-start" />
                        )}
                        Validar pagamento
                      </Button>
                    </>
                  ) : null}
                  {payment.boleto?.bankSlipUrl ? (
                    <Button asChild>
                      <a href={payment.boleto.bankSlipUrl} target="_blank" rel="noreferrer">
                        Abrir boleto
                      </a>
                    </Button>
                  ) : null}
                  {payment.invoiceUrl ? (
                    <Button asChild variant="outline">
                      <a href={payment.invoiceUrl} target="_blank" rel="noreferrer">
                        Abrir fatura
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(pendingBillingSwitch)}
        onOpenChange={(open) => {
          if (!open) setPendingBillingSwitch(null)
        }}
      >
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Você já iniciou um pagamento. Ao trocar a forma de pagamento, a cobrança anterior será
              cancelada e você precisará gerar uma nova.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingBillingSwitch) return
                updateField("billingType", pendingBillingSwitch)
                setPendingBillingSwitch(null)
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
