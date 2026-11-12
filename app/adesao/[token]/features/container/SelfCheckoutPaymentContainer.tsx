"use client"

import { useEffect, useMemo, useState, type ComponentProps, type FormEvent } from "react"
import { AlertTriangle, Clock3 } from "lucide-react"
import { toast } from "sonner"

import { ForceLightDocument } from "@/app/forms/[publicId]/features/components/ForceLightDocument"
import { isPixExpired } from "@/components/public-checkout/pixExpiry"
import { PublicCheckoutShell } from "@/components/public-checkout/PublicCheckoutShell"
import type { CheckoutPaymentProvider } from "@/components/public-checkout/providerBranding"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { maskPhone } from "@/lib/masks"
import { normalizeAvailableBillingTypes } from "@/lib/payment-methods/availability-client"
import { AdhesionOrderSummary } from "../components/AdhesionOrderSummary"
import { AdhesionPaymentActions } from "../components/AdhesionPaymentActions"
import {
  AdhesionAddressFields,
  AdhesionInstallmentsField,
  AdhesionPayerFields,
  AdhesionStepHeading,
} from "../components/AdhesionPaymentFields"
import { AdhesionPaymentMethod } from "../components/AdhesionPaymentMethod"
import { AdhesionStatusScreen, type AdhesionStatusKind } from "../components/AdhesionStatusScreen"
import { AdhesionSuccessScreen } from "../components/AdhesionSuccessScreen"
import { formatCountdown, useAdhesionAttemptTimer } from "../context/AdhesionAttemptTimerHook"
import { useAdhesionPaymentForm } from "../context/AdhesionPaymentFormHook"
import { usePublicAdhesion } from "../context/PublicAdhesionHook"
import type {
  PublicAdhesionBillingType,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "../context/PublicAdhesionTypes"
import { buildAdhesionCheckoutInput } from "../utils/adhesionCheckoutInput"
import { buildAdhesionPaymentSummary, maxInstallmentsFor, toCents } from "../utils/adhesionPayment"
import { AbacateCardField } from "../components/AbacateCardField"
import { useAbacateCard } from "../context/AbacateCardHook"
import type { AdhesionPaymentFieldName } from "../utils/adhesionPaymentForm"

const ATTEMPT_STORAGE_PREFIX = "public-adhesion-attempt-start:"
const POLL_INTERVAL_MS = 8000

function focusField(field: AdhesionPaymentFieldName) {
  const element = document.getElementById(`adhesion-${field}`)
  if (!element) return
  element.scrollIntoView({ block: "center" })
  element.focus()
}

function pickInitialMethod(
  preset: PublicAdhesionBillingType | null,
  methods: readonly PublicAdhesionBillingType[],
): PublicAdhesionBillingType {
  if (preset && methods.includes(preset)) return preset
  return methods.includes("PIX") ? "PIX" : (methods[0] ?? "PIX")
}

/** Dados da tela de finalização: empresa, e-mail que recebe o acesso, plano, forma e valor pagos. */
function successScreenProps(input: {
  details: PublicAdhesionDetails
  typedEmail: string
  isCard: boolean
  installments: number
  payment: PublicAdhesionPayment | null
  fallbackTotal: number
}): ComponentProps<typeof AdhesionSuccessScreen> {
  const { details } = input
  return {
    companyName: details.companyName ?? "",
    email: input.typedEmail.trim() || details.email || "",
    planLabel: details.cycleMonths > 1 ? `${details.cycleLabel} (${details.cycleMonths} meses)` : details.cycleLabel,
    paymentLabel: input.isCard ? `Cartão de crédito em ${input.installments}x` : "PIX à vista",
    total: input.payment?.amount || input.fallbackTotal,
  }
}

/** Fim do fluxo: confirmação completa quando pago; senão, pedido ou tentativa expirados. */
function FinalScreen({
  kind,
  success,
  onResume,
}: {
  kind: AdhesionStatusKind
  success: ComponentProps<typeof AdhesionSuccessScreen>
  onResume: () => void
}) {
  if (kind === "paid") return <AdhesionSuccessScreen {...success} />
  return <AdhesionStatusScreen kind={kind} onResume={onResume} />
}

function statusKindFor(input: {
  isPaid: boolean
  details: PublicAdhesionDetails
  hasPayment: boolean
  attemptExpired: boolean
}): AdhesionStatusKind | null {
  if (input.isPaid) return "paid"
  if (input.details.status === "expired" || input.details.status === "canceled") return "expired-order"
  if (input.attemptExpired && !input.hasPayment) return "expired-attempt"
  return null
}

function cardPublicKeyOf(details: PublicAdhesionDetails | null): string | null {
  return details?.cardPublicKey ?? null
}

/** Cartão só com o formulário seguro do Abacate Pay (chave pública); sem ela, só PIX. */
function availableMethodsFor(details: PublicAdhesionDetails | null): PublicAdhesionBillingType[] {
  const hasCardForm = Boolean(cardPublicKeyOf(details))
  return normalizeAvailableBillingTypes(details?.availableBillingTypes).filter(
    (method) => method !== "CREDIT_CARD" || hasCardForm,
  )
}

/** Cartão pelo Abacate Pay: formulário seguro (iframe), erro de validação e parcelas. */
function CardSection({
  card,
  publicKey,
  total,
  maxInstallments,
  fixedSchedule,
  installments,
  disabled,
}: {
  card: ReturnType<typeof useAbacateCard>
  publicKey: string
  total: number
  maxInstallments: number
  fixedSchedule: number[] | null
  installments: number
  disabled: boolean
}) {
  return (
    <section aria-labelledby="adhesion-card-title" className="flex flex-col gap-5">
      <AdhesionStepHeading
        number={3}
        id="adhesion-card-title"
        title="Dados do cartão"
        description="Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app."
      />
      <AbacateCardField ref={card.cardFieldRef} publicKey={publicKey} amountInCents={toCents(total)} />
      {card.cardError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {card.cardError}
        </p>
      ) : null}
      <AdhesionInstallmentsField
        total={total}
        maxInstallments={maxInstallments}
        fixedSchedule={fixedSchedule}
        value={installments}
        disabled={disabled}
        onChange={card.setInstallmentsChoice}
      />
    </section>
  )
}

/** Tela de pagamento das adesões do auto-checkout: forma de pagamento, dados, cartão e resumo. */
export function SelfCheckoutPaymentContainer() {
  const { token, details, payment, isSubmitting, error, submitCheckout, refreshPaymentStatus } = usePublicAdhesion()

  const cardPublicKey = cardPublicKeyOf(details)
  const methods = useMemo(() => availableMethodsFor(details), [details])
  const abacateCard = useAbacateCard()
  const [billingType, setBillingType] = useState<PublicAdhesionBillingType>(() =>
    pickInitialMethod(details?.billingType ?? null, methods),
  )
  const [isValidating, setIsValidating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const usesProviderPix = details?.pixProvider === "ABACATE_PAY"
  const isCard = billingType === "CREDIT_CARD"
  // PIX e cartão do Abacate dispensam endereço; só o PIX legado do Asaas ainda exige.
  const needsAddress = !isCard && !usesProviderPix
  const formOptions = useMemo(() => ({ needsAddress }), [needsAddress])
  const form = useAdhesionPaymentForm(
    {
      fullName: details?.fullName ?? "",
      email: details?.email ?? "",
      phone: maskPhone(details?.phone ?? ""),
    },
    formOptions,
  )
  const timer = useAdhesionAttemptTimer(`${ATTEMPT_STORAGE_PREFIX}${token}`)

  const hasPayment = Boolean(payment?.invoiceUrl || payment?.pix || payment?.paymentId)
  const isLocked = isSubmitting || hasPayment
  const isPaid = payment?.status === "paid" || details?.status === "paid"
  const pixExpired = Boolean(
    usesProviderPix && payment?.status === "pending" && isPixExpired(payment.pix?.expirationDate, timer.now),
  )

  // Enquanto o pagamento está pendente, consulta o status a cada poucos segundos.
  useEffect(() => {
    if (!payment || isPaid || timer.isExpired || pixExpired) return
    if (payment.status === "canceled" || payment.status === "expired") return
    const refresh = () => void refreshPaymentStatus({ sync: true }).catch(() => undefined)
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isPaid, payment, pixExpired, refreshPaymentStatus, timer.isExpired])

  if (!details) return null

  const summary = buildAdhesionPaymentSummary(details, billingType)
  const pixSummary = buildAdhesionPaymentSummary(details, "PIX")
  const cardSummary = buildAdhesionPaymentSummary(details, "CREDIT_CARD")
  const maxInstallments = maxInstallmentsFor(details)
  const fixedSchedule =
    details.installmentSplitMode === "CUSTOM" && details.installmentSchedule.length > 0
      ? details.installmentSchedule
      : null
  const installments = isCard ? Math.min(abacateCard.installmentsChoice, maxInstallments) : 1
  const provider: CheckoutPaymentProvider = usesProviderPix ? "ABACATE_PAY" : "ASAAS"

  async function submitPayment(): Promise<void> {
    if (!details) return
    const payer = {
      fullName: form.values.fullName,
      email: form.values.email,
      phone: form.values.phone,
      cpfCnpj: details.cpfCnpj ?? "",
    }
    // Cartão: o token do Abacate é gerado agora (vale 60s); sem ele não há cobrança.
    const cardToken = isCard ? await abacateCard.tokenizeCard({ ...payer, cnpj: payer.cpfCnpj }) : null
    if (isCard && !cardToken) {
      document.getElementById("adhesion-card-title")?.scrollIntoView({ block: "center" })
      return
    }
    try {
      await submitCheckout(
        buildAdhesionCheckoutInput({ payer, values: form.values, billingType, installments, cardToken }),
      )
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível gerar o pagamento.")
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLocked) return
    const invalid = form.validateForSubmit()
    if (invalid) return focusField(invalid)
    await submitPayment()
  }

  async function handleValidate() {
    if (isValidating) return
    setIsValidating(true)
    try {
      await refreshPaymentStatus({ sync: true })
    } catch (refreshError) {
      toast.error(refreshError instanceof Error ? refreshError.message : "Não foi possível validar agora.")
    } finally {
      setIsValidating(false)
    }
  }

  async function handleRegenerate() {
    if (isRegenerating) return
    setIsRegenerating(true)
    try {
      await submitPayment()
      timer.restart()
    } finally {
      setIsRegenerating(false)
    }
  }

  const shellProps = { variant: "light" as const, provider, issuedLabel: "Vendido por", issuedValue: "Corretor Studio" }
  const statusKind = statusKindFor({ isPaid, details, hasPayment, attemptExpired: timer.isExpired })
  if (statusKind) {
    return (
      <PublicCheckoutShell {...shellProps}>
        <ForceLightDocument />
        <FinalScreen
          kind={statusKind}
          onResume={timer.restart}
          success={successScreenProps({
            details,
            typedEmail: form.values.email,
            isCard,
            installments,
            payment,
            fallbackTotal: summary.total,
          })}
        />
      </PublicCheckoutShell>
    )
  }

  const fieldProps = {
    values: form.values,
    errors: form.errors,
    disabled: isLocked,
    onChange: form.setField,
    onBlur: form.touch,
  }

  return (
    <PublicCheckoutShell {...shellProps}>
      <ForceLightDocument />
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
            Finalize seu pagamento
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
            <span>Escolha a forma de pagamento e conclua a contratação.</span>
            {timer.remainingMs != null ? (
              <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                <Clock3 className="size-4" aria-hidden />
                Pedido reservado por {formatCountdown(timer.remainingMs)}
              </span>
            ) : null}
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Não foi possível carregar o pedido</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          <div className="flex flex-col gap-10">
            <section aria-labelledby="adhesion-method-title" className="flex flex-col gap-5">
              <AdhesionStepHeading number={1} id="adhesion-method-title" title="Forma de pagamento" />
              <AdhesionPaymentMethod
                methods={methods}
                value={billingType}
                pixTotal={pixSummary.total}
                cardTotal={cardSummary.total}
                pixSavings={pixSummary.pixSavings}
                maxInstallments={maxInstallments}
                disabled={isLocked}
                onChange={setBillingType}
              />
            </section>

            <section aria-labelledby="adhesion-payer-title" className="flex flex-col gap-5">
              <AdhesionStepHeading
                number={2}
                id="adhesion-payer-title"
                title="Quem está contratando"
                description="Campos marcados com * são obrigatórios."
              />
              <AdhesionPayerFields {...fieldProps} />
            </section>

            {needsAddress ? (
              <section aria-labelledby="adhesion-address-title" className="flex flex-col gap-5">
                <AdhesionStepHeading
                  number={3}
                  id="adhesion-address-title"
                  title="Endereço de cobrança"
                  description="Informe o CEP e completamos o restante."
                />
                <AdhesionAddressFields {...fieldProps} />
              </section>
            ) : null}

            {isCard && cardPublicKey ? (
              <CardSection
                card={abacateCard}
                publicKey={cardPublicKey}
                total={summary.total}
                maxInstallments={maxInstallments}
                fixedSchedule={fixedSchedule}
                installments={installments}
                disabled={isLocked}
              />
            ) : null}
          </div>

          <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
            <AdhesionOrderSummary
              companyName={details.companyName ?? null}
              cnpj={details.cpfCnpj}
              cycleLabel={details.cycleLabel}
              months={details.cycleMonths}
              summary={summary}
              installments={installments}
            >
              <AdhesionPaymentActions
                payment={payment}
                hasPayment={hasPayment}
                isCard={isCard}
                isSubmitting={isSubmitting}
                isLocked={isLocked}
                isResolvingCep={form.isResolvingCep}
                pixExpired={pixExpired}
                isValidating={isValidating}
                isRegenerating={isRegenerating}
                onValidate={handleValidate}
                onRegenerate={handleRegenerate}
              />
            </AdhesionOrderSummary>
          </aside>
        </form>
      </div>
    </PublicCheckoutShell>
  )
}
