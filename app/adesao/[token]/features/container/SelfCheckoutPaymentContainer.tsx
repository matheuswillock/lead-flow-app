"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react"
import { Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { SelfCheckoutLoadError } from "@/app/checkout/features/components/SelfCheckoutStateMessages"
import { SelfCheckoutSkeleton } from "@/app/checkout/features/components/SelfCheckoutSkeleton"
import { ForceLightDocument } from "@/app/forms/[publicId]/features/components/ForceLightDocument"
import { CheckoutInstallmentsSelect } from "@/components/checkout/CheckoutInstallmentsSelect"
import { CheckoutMobilePayBar } from "@/components/checkout/CheckoutMobilePayBar"
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary"
import { CheckoutPaymentMethod } from "@/components/checkout/CheckoutPaymentMethod"
import { CheckoutPhaseNav } from "@/components/checkout/CheckoutPhaseNav"
import { CheckoutPixPayment } from "@/components/checkout/CheckoutPixPayment"
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper"
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess"
import { CheckoutTermsNotice } from "@/components/checkout/CheckoutTermsNotice"
import {
  clampPhaseIndex,
  nextPhaseIndex,
  previousPhaseIndex,
} from "@/components/checkout/checkoutPhases"
import { isPixExpired } from "@/components/public-checkout/pixExpiry"
import { PublicCheckoutShell } from "@/components/public-checkout/PublicCheckoutShell"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { maskPhone } from "@/lib/masks"
import { normalizeAvailableBillingTypes } from "@/lib/payment-methods/availability-client"
import { AbacateCardField } from "../components/AbacateCardField"
import { AdhesionAddressFields, AdhesionPayerFields } from "../components/AdhesionPaymentFields"
import { AdhesionCardStatusPanel } from "../components/AdhesionCardStatusPanel"
import { AdhesionStatusScreen, type AdhesionStatusKind } from "../components/AdhesionStatusScreen"
import { AdhesionSummaryLines } from "../components/AdhesionSummaryLines"
import { useAbacateCard } from "../context/AbacateCardHook"
import { useAdhesionAttemptTimer } from "../context/AdhesionAttemptTimerHook"
import { useAdhesionPaymentForm } from "../context/AdhesionPaymentFormHook"
import { usePublicAdhesion } from "../context/PublicAdhesionHook"
import type {
  PublicAdhesionBillingType,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "../context/PublicAdhesionTypes"
import {
  ADHESION_PHASE_LABEL,
  adhesionPhasesFor,
  fieldElementId,
  fieldsOfPhase,
  firstInvalidFieldInPhase,
  phaseIndexOfField,
  type AdhesionPhaseId,
} from "../utils/adhesionCheckoutPhases"
import { buildAdhesionCheckoutInput } from "../utils/adhesionCheckoutInput"
import {
  buildAdhesionPaymentSummary,
  formatBRL,
  maxInstallmentsFor,
  toCents,
} from "../utils/adhesionPayment"
import {
  validateAdhesionPaymentForm,
  type AdhesionPaymentFieldName,
} from "../utils/adhesionPaymentForm"

const ATTEMPT_STORAGE_PREFIX = "public-adhesion-attempt-start:"
const POLL_INTERVAL_MS = 8000

const SHELL_PROPS = {
  variant: "light",
  provider: null,
  issuedLabel: "Vendido por",
  issuedValue: "Corretor Studio",
} as const

/** Foca o campo depois que a fase nova monta (a troca de fase anima antes de renderizar). */
function focusWhenReady(id: string, attempts = 30) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ block: "center" })
    element.focus()
    return
  }
  if (attempts > 0) requestAnimationFrame(() => focusWhenReady(id, attempts - 1))
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
}): ComponentProps<typeof CheckoutSuccess> {
  const { details } = input
  return {
    companyName: details.companyName ?? "",
    email: input.typedEmail.trim() || details.email || "",
    planLabel:
      details.cycleMonths > 1
        ? `${details.cycleLabel} (${details.cycleMonths} meses)`
        : details.cycleLabel,
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
  success: ComponentProps<typeof CheckoutSuccess>
  onResume: () => void
}) {
  if (kind === "paid") return <CheckoutSuccess {...success} />
  return <AdhesionStatusScreen kind={kind} onResume={onResume} />
}

function statusKindFor(input: {
  isPaid: boolean
  details: PublicAdhesionDetails
  hasPayment: boolean
  attemptExpired: boolean
}): AdhesionStatusKind | null {
  if (input.isPaid) return "paid"
  if (input.details.status === "expired" || input.details.status === "canceled")
    return "expired-order"
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

function submitLabelFor(input: {
  isTokenizing: boolean
  isSubmitting: boolean
  isCard: boolean
}): string {
  if (input.isTokenizing) return "Validando o cartão..."
  if (input.isSubmitting)
    return input.isCard ? "Processando o pagamento..." : "Gerando o QR Code..."
  return input.isCard ? "Pagar com cartão" : "Gerar QR Code PIX"
}

function payCaptionFor(isCard: boolean, installments: number): string {
  if (!isCard) return "à vista no PIX"
  return installments > 1 ? `em ${installments}x no cartão` : "no cartão de crédito"
}

function PhaseHeading({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2
        id={id}
        className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground"
      >
        {title}
      </h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Cartão pelo Abacate Pay: formulário seguro (iframe) e parcelas. */
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
      <PhaseHeading
        id="adhesion-card-title"
        title="Dados do cartão"
        description="Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app."
      />
      <AbacateCardField
        ref={card.cardFieldRef}
        publicKey={publicKey}
        amountInCents={toCents(total)}
      />
      {card.cardError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {card.cardError}
        </p>
      ) : null}
      {fixedSchedule ? (
        // Cronograma fixo do produto: o cliente não escolhe parcelas, então mostra o cronograma em texto.
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Parcelas</p>
          <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {fixedSchedule.map((amount, index) => (
              <li
                key={`${index}-${amount}`}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                {index + 1}ª parcela:{" "}
                <span className="font-semibold text-foreground">{formatBRL(amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <CheckoutInstallmentsSelect
          total={total}
          maxInstallments={maxInstallments}
          value={installments}
          disabled={disabled}
          onChange={card.setInstallmentsChoice}
        />
      )}
    </section>
  )
}

/**
 * Contratação self-checkout em fases: seus dados, endereço (só PIX legado) ou dados do cartão. Forma
 * de pagamento e resumo ficam sempre na lateral. O pedido já existe; o pagamento é gerado ao enviar.
 */
export function SelfCheckoutPaymentContainer() {
  const { token, details, payment, isSubmitting, error, submitCheckout, refreshPaymentStatus } =
    usePublicAdhesion()

  const cardPublicKey = cardPublicKeyOf(details)
  const methods = useMemo(() => availableMethodsFor(details), [details])
  const abacateCard = useAbacateCard()
  const [billingType, setBillingType] = useState<PublicAdhesionBillingType>(() =>
    pickInitialMethod(details?.billingType ?? null, methods),
  )
  const [phaseIndex, setPhaseIndex] = useState(0)
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
    usesProviderPix &&
    payment?.status === "pending" &&
    isPixExpired(payment.pix?.expirationDate, timer.now),
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

  // Pagamento gerado troca o formulário pelo QR Code ou pelo status: a página volta ao topo.
  useEffect(() => {
    if (hasPayment) window.scrollTo({ top: 0 })
  }, [hasPayment])

  if (!details) {
    return (
      <PublicCheckoutShell {...SHELL_PROPS}>
        <ForceLightDocument />
        <SelfCheckoutSkeleton />
      </PublicCheckoutShell>
    )
  }

  const summary = buildAdhesionPaymentSummary(details, billingType)
  const pixSummary = buildAdhesionPaymentSummary(details, "PIX")
  const cardSummary = buildAdhesionPaymentSummary(details, "CREDIT_CARD")
  const maxInstallments = maxInstallmentsFor(details)
  const fixedSchedule =
    details.installmentSplitMode === "CUSTOM" && details.installmentSchedule.length > 0
      ? details.installmentSchedule
      : null
  const installments = isCard ? Math.min(abacateCard.installmentsChoice, maxInstallments) : 1

  const phases = adhesionPhasesFor({ isCard, hasCardForm: Boolean(cardPublicKey), needsAddress })
  const hasCardPhase = phases.includes("card")
  const activeIndex = clampPhaseIndex(phaseIndex, phases.length)
  const activePhase: AdhesionPhaseId = phases[activeIndex]
  const isLastPhase = activeIndex === phases.length - 1
  const isBusy = isSubmitting || abacateCard.isTokenizing
  const submitText = submitLabelFor({
    isTokenizing: abacateCard.isTokenizing,
    isSubmitting,
    isCard,
  })
  const email = form.values.email.trim() || null

  async function submitPayment(): Promise<void> {
    if (!details) return
    const payer = {
      fullName: form.values.fullName,
      email: form.values.email,
      phone: form.values.phone,
      cpfCnpj: details.cpfCnpj ?? "",
    }
    // Cartão: o token do Abacate é gerado agora (vale 60s); sem ele não há cobrança.
    const cardToken = isCard
      ? await abacateCard.tokenizeCard({ ...payer, cnpj: payer.cpfCnpj })
      : null
    if (isCard && !cardToken) {
      document.getElementById("adhesion-card-title")?.scrollIntoView({ block: "center" })
      return
    }
    try {
      await submitCheckout(
        buildAdhesionCheckoutInput({
          payer,
          values: form.values,
          billingType,
          installments,
          cardToken,
        }),
      )
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : "Não foi possível gerar o pagamento.",
      )
    }
  }

  /** Leva à fase do campo com erro e foca o campo; a fase é a que valida o campo nesta forma. */
  function goToField(field: AdhesionPaymentFieldName) {
    const index = phaseIndexOfField(phases, field)
    if (index >= 0) setPhaseIndex(index)
    focusWhenReady(fieldElementId(field))
  }

  /** Continuar valida só a fase atual e mostra os erros dela. */
  function goNext() {
    fieldsOfPhase(activePhase).forEach((field) => form.touch(field))
    const invalid = firstInvalidFieldInPhase(
      validateAdhesionPaymentForm(form.values, formOptions),
      activePhase,
    )
    if (invalid) return focusWhenReady(fieldElementId(invalid))
    setPhaseIndex(nextPhaseIndex(activeIndex, phases.length))
  }

  function goBack() {
    setPhaseIndex(previousPhaseIndex(activeIndex))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLocked) return
    // Envio valida tudo; o primeiro campo inválido leva à fase dele.
    const invalid = form.validateForSubmit()
    if (invalid) return goToField(invalid)
    // No cartão, o pagamento só é enviado da fase dos dados do cartão.
    if (hasCardPhase && activePhase !== "card") return setPhaseIndex(phases.length - 1)
    await submitPayment()
  }

  async function handleValidate() {
    if (isValidating) return
    setIsValidating(true)
    try {
      await refreshPaymentStatus({ sync: true })
    } catch (refreshError) {
      toast.error(
        refreshError instanceof Error ? refreshError.message : "Não foi possível validar agora.",
      )
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

  const statusKind = statusKindFor({ isPaid, details, hasPayment, attemptExpired: timer.isExpired })
  if (statusKind) {
    return (
      <PublicCheckoutShell {...SHELL_PROPS}>
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

  function renderPhase(phase: AdhesionPhaseId): ReactNode {
    if (phase === "payer") {
      return (
        <section aria-labelledby="adhesion-payer-title" className="flex flex-col gap-5">
          <PhaseHeading
            id="adhesion-payer-title"
            title="Seus dados"
            description="Campos marcados com * são obrigatórios."
          />
          <AdhesionPayerFields {...fieldProps} />
        </section>
      )
    }
    if (phase === "address") {
      return (
        <section aria-labelledby="adhesion-address-title" className="flex flex-col gap-5">
          <PhaseHeading
            id="adhesion-address-title"
            title="Endereço de cobrança"
            description="Informe o CEP e completamos o restante."
          />
          <AdhesionAddressFields {...fieldProps} />
        </section>
      )
    }
    return (
      <CardSection
        card={abacateCard}
        publicKey={cardPublicKey ?? ""}
        total={summary.total}
        maxInstallments={maxInstallments}
        fixedSchedule={fixedSchedule}
        installments={installments}
        disabled={isLocked}
      />
    )
  }

  // Depois do pedido criado, a coluna principal mostra o QR Code (PIX) ou o status (cartão).
  let paymentResult: ReactNode = null
  if (payment?.pix) {
    paymentResult = (
      <CheckoutPixPayment
        pix={payment.pix}
        email={email}
        now={timer.now}
        isExpired={pixExpired}
        isValidating={isValidating}
        isRegenerating={isRegenerating}
        onValidate={handleValidate}
        onRegenerate={handleRegenerate}
      />
    )
  } else if (hasPayment) {
    paymentResult = (
      <AdhesionCardStatusPanel
        invoiceUrl={payment?.invoiceUrl ?? null}
        email={email}
        isValidating={isValidating}
        onValidate={handleValidate}
      />
    )
  }

  const footer = hasPayment ? undefined : (
    <>
      <CheckoutTermsNotice />
      <Button
        type="submit"
        size="lg"
        className="w-full max-lg:hidden"
        disabled={isBusy || form.isResolvingCep}
        aria-busy={isBusy}
      >
        {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {submitText}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {isCard
          ? "Seus dados do cartão são enviados com segurança e não ficam salvos conosco."
          : "O QR Code vale por tempo limitado. O acesso chega por e-mail após a confirmação."}
      </p>
    </>
  )

  return (
    <PublicCheckoutShell {...SHELL_PROPS}>
      <ForceLightDocument />
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
            Contrate o Corretor Studio
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            {methods.includes("CREDIT_CARD")
              ? "Pague por PIX ou cartão e receba o acesso por e-mail."
              : "Pague por PIX e receba o acesso por e-mail."}
          </p>
        </div>

        {error ? (
          <SelfCheckoutLoadError message={error} onRetry={() => window.location.reload()} />
        ) : null}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          <div className="flex min-w-0 flex-col gap-6">
            {hasPayment ? (
              paymentResult
            ) : (
              <>
                <CheckoutStepper
                  labels={phases.map((phase) => ADHESION_PHASE_LABEL[phase])}
                  currentIndex={activeIndex}
                >
                  {renderPhase(activePhase)}
                </CheckoutStepper>
                <CheckoutPhaseNav
                  onBack={activeIndex > 0 ? goBack : undefined}
                  onNext={isLastPhase ? undefined : goNext}
                  disabled={isLocked}
                />
              </>
            )}
          </div>

          <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
            <CheckoutOrderSummary footer={footer}>
              <CheckoutPaymentMethod
                methods={methods}
                value={billingType}
                pixTotal={pixSummary.total}
                cardTotal={cardSummary.total}
                pixSavings={pixSummary.pixSavings}
                maxInstallments={maxInstallments}
                disabled={isLocked}
                onChange={setBillingType}
              />
              <Separator />
              <AdhesionSummaryLines
                companyName={details.companyName ?? null}
                cnpj={details.cpfCnpj}
                cycleLabel={details.cycleLabel}
                months={details.cycleMonths}
                summary={summary}
                installments={installments}
              />
            </CheckoutOrderSummary>
          </aside>

          {/* Celular: total e ação sempre à vista. Nas fases intermediárias a ação é Continuar. */}
          {hasPayment ? null : (
            <CheckoutMobilePayBar
              total={summary.total}
              caption={payCaptionFor(isCard, installments)}
              label={isLastPhase ? submitText : "Continuar"}
              isBusy={isBusy}
              disabled={isBusy || form.isResolvingCep}
              onContinue={isLastPhase ? undefined : goNext}
            />
          )}
        </form>
      </div>
    </PublicCheckoutShell>
  )
}
