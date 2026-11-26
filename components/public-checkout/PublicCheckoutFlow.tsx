"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { AlertTriangle, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { useAbacateCard } from "@/app/adesao/[token]/features/context/AbacateCardHook"
import { ForceLightDocument } from "@/app/forms/[publicId]/features/components/ForceLightDocument"
import { SelfCheckoutSkeleton } from "@/app/checkout/features/components/SelfCheckoutSkeleton"
import {
  SelfCheckoutLoadError,
  SelfCheckoutUnavailable,
} from "@/app/checkout/features/components/SelfCheckoutStateMessages"
import { CheckoutMobilePayBar } from "@/components/checkout/CheckoutMobilePayBar"
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary"
import { CheckoutPaymentMethod } from "@/components/checkout/CheckoutPaymentMethod"
import { CheckoutPhaseNav } from "@/components/checkout/CheckoutPhaseNav"
import { CheckoutPixPayment } from "@/components/checkout/CheckoutPixPayment"
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper"
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess"
import { CheckoutTermsNotice } from "@/components/checkout/CheckoutTermsNotice"
import {
  errorsForPhase,
  nextPhaseIndex,
  phaseIndexForField,
  previousPhaseIndex,
} from "@/components/checkout/checkoutPhases"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { AvailableBillingTypes } from "@/lib/payment-methods/availability"
import { pickBillingType, resolveCheckoutMethods } from "./checkoutMethods"
import { isPixExpired } from "./pixExpiry"
import { getProviderBranding, type CheckoutPaymentProvider } from "./providerBranding"
import {
  PUBLIC_CHECKOUT_PHASES,
  firstPaymentField,
  validatePaymentForm,
  type PaymentFieldErrors,
  type PaymentFieldName,
} from "./publicCheckoutPhases"
import { PublicCheckoutCardSection, PublicCheckoutPaymentStep, publicCheckoutFieldId } from "./PublicCheckoutPaymentStep"
import { PublicCheckoutShell } from "./PublicCheckoutShell"
import { PublicCheckoutSummaryStep, PublicCheckoutTotals } from "./PublicCheckoutSummaryStep"
import type {
  PublicCheckoutBillingType,
  PublicCheckoutDetails,
  PublicCheckoutPaymentInput,
  PublicCheckoutPaymentView,
  PublicCheckoutPayerPrefill,
} from "./publicCheckoutTypes"
import { usePublicCheckoutPayer } from "./usePublicCheckoutPayer"

const DEFAULT_ATTEMPT_DURATION_MS = 25 * 60 * 1000
const LAST_PHASE = PUBLIC_CHECKOUT_PHASES.length - 1

/** O cartão vai só como token do Abacate Pay; os campos crus do contrato antigo ficam vazios. */
const EMPTY_CREDIT_CARD: PublicCheckoutPaymentInput["creditCard"] = {
  holderName: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  ccv: "",
}

const digitsOnly = (value: string, maxLength: number) => value.replace(/\D/g, "").slice(0, maxLength)

/** A fase nova só monta depois da troca; espera o campo aparecer antes de focar. */
function focusWhenReady(id: string, attempts = 30) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ block: "center" })
    element.focus()
    return
  }
  if (attempts > 0) requestAnimationFrame(() => focusWhenReady(id, attempts - 1))
}

function reloadPage() {
  window.location.reload()
}

/**
 * Checkout compartilhado (add-on e adesão por link) no padrão do `/checkout`: duas fases, Resumo e
 * Pagamento; a forma de pagamento e o total ficam na lateral, com o envio. O pedido é criado ao
 * enviar e o PIX ou o cartão aparecem na mesma tela.
 */
export function PublicCheckoutFlow({
  attemptStorageKey,
  attemptDurationMs = DEFAULT_ATTEMPT_DURATION_MS,
  details,
  payment,
  isLoading,
  isSubmitting,
  error,
  maxInstallments: maxInstallmentsOfContract,
  prefill,
  onSubmit,
  onRefreshStatus,
  pixOnly = false,
  availableMethods,
  successVariant = "newContract",
  successDescription,
  successHref = "/",
  provider,
  canRegeneratePix = false,
  abacatePublicKey,
  skipAddress = false,
  onRetry,
}: {
  /**
   * Métodos que o checkout pode oferecer. Ausente = somente PIX (falha fechada): o cartão
   * só aparece quando o servidor o declara disponível.
   */
  availableMethods?: AvailableBillingTypes
  /** `undefined` = Asaas (legado); `null` = ainda não resolvido (rodapé sem marca). */
  provider?: CheckoutPaymentProvider | null
  /** Quando true, PIX/tentativa expirados oferecem "Gerar novo PIX" reaproveitando os dados do pagador. */
  canRegeneratePix?: boolean
  /** Chave pública do Abacate Pay. Sem ela o cartão não é oferecido. */
  abacatePublicKey?: string | null
  skipAddress?: boolean
  /** Legado: PIX sem coleta de endereço. Implica `availableMethods = ["PIX"]`. */
  pixOnly?: boolean
  /** Copy da tela de sucesso: contratação nova (padrão) ou add-on. */
  successVariant?: "newContract" | "addon"
  /** Texto extra abaixo da tela de sucesso (ex.: prazo de crédito). A copy da variante já vem no CheckoutSuccess. */
  successDescription?: string
  /** Para onde a confirmação do add-on leva após alguns segundos (padrão: página inicial pública). */
  successHref?: string
  attemptStorageKey: string
  attemptDurationMs?: number
  details: PublicCheckoutDetails | null
  payment: PublicCheckoutPaymentView | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  maxInstallments: number
  prefill: PublicCheckoutPayerPrefill
  onSubmit: (input: PublicCheckoutPaymentInput) => Promise<void>
  onRefreshStatus?: (options?: { sync?: boolean }) => Promise<void>
  /** Nova tentativa após erro de carregamento. Sem ele, recarrega a página. */
  onRetry?: () => void
}) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [chosenBillingType, setChosenBillingType] = useState<PublicCheckoutBillingType | null>(null)
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [isRegeneratingPix, setIsRegeneratingPix] = useState(false)
  const [isValidatingPayment, setIsValidatingPayment] = useState(false)
  const lastInputRef = useRef<PublicCheckoutPaymentInput | null>(null)

  const payer = usePublicCheckoutPayer({ prefill, ready: details !== null })
  const card = useAbacateCard()

  const methods = useMemo(
    () => resolveCheckoutMethods({ availableMethods, pixOnly }),
    // A identidade do array muda a cada render do pai; a chave estável evita recalcular à toa.
    [availableMethods?.join(","), pixOnly],
  )
  // O cartão só é oferecido com o formulário seguro configurado; sem chave, só PIX.
  const offeredMethods: AvailableBillingTypes = methods.filter(
    (method) => method === "PIX" || (method === "CREDIT_CARD" && Boolean(abacatePublicKey)),
  )
  const billingType = pickBillingType(chosenBillingType ?? details?.presetBillingType, offeredMethods)
  const isCard = billingType === "CREDIT_CARD"
  const maxInstallments = isCard ? Math.max(1, maxInstallmentsOfContract) : 1
  const installments = isCard ? Math.min(card.installmentsChoice, maxInstallments) : 1

  const requiresAddress = !pixOnly && !skipAddress
  const expiresAt = attemptStartedAt ? attemptStartedAt + attemptDurationMs : null
  const isAttemptExpired = expiresAt !== null && now >= expiresAt
  const isPaid = payment?.status === "paid"
  const isLocked = isSubmitting || Boolean(payment)
  const isBusy = isSubmitting || card.isTokenizing || isRegeneratingPix
  const isLastPhase = phaseIndex === LAST_PHASE
  const isPixExpiredNow =
    canRegeneratePix && payment?.status === "pending" && isPixExpired(payment.pix?.expirationDate, now)

  const pixTotal = details?.billingTypePrices.PIX.total ?? 0
  const cardTotal = details?.billingTypePrices.CREDIT_CARD.total ?? 0
  const orderTotal = details?.billingTypePrices[billingType].total ?? 0
  const payerEmail = payer.form.email.trim()

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem(attemptStorageKey)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed) && parsed > 0) setAttemptStartedAt(parsed)
      return
    }
    const start = Date.now()
    window.sessionStorage.setItem(attemptStorageKey, String(start))
    setAttemptStartedAt(start)
  }, [attemptStorageKey])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isAttemptExpired || typeof window === "undefined") return
    window.sessionStorage.removeItem(attemptStorageKey)
  }, [attemptStorageKey, isAttemptExpired])

  // Enquanto o PIX ou o cartão não é confirmado, a tela consulta o status sozinha.
  useEffect(() => {
    if (!onRefreshStatus) return
    if (isLoading || isSubmitting || isAttemptExpired) return
    if (!payment) return
    if (payment.status === "paid" || payment.status === "canceled" || payment.status === "expired") return

    void onRefreshStatus({ sync: true }).catch((refreshError) => {
      console.error("[PublicCheckoutFlow][auto-refresh]", refreshError)
    })

    const interval = setInterval(() => {
      void onRefreshStatus({ sync: true }).catch((refreshError) => {
        console.error("[PublicCheckoutFlow][auto-refresh]", refreshError)
      })
    }, 8000)

    return () => clearInterval(interval)
  }, [isAttemptExpired, isLoading, isSubmitting, onRefreshStatus, payment])

  function validate(): PaymentFieldErrors {
    return validatePaymentForm(payer.form, { requiresAddress, cepResolved: payer.cepResolved })
  }

  /** Leva à fase do campo com erro e foca o campo. */
  function goToField(field: PaymentFieldName) {
    const index = phaseIndexForField(PUBLIC_CHECKOUT_PHASES, field)
    if (index >= 0) setPhaseIndex(index)
    focusWhenReady(publicCheckoutFieldId(field))
  }

  /** Continuar valida só a fase atual; o Resumo não tem campos, então sempre avança. */
  function goNext() {
    const errors = validate()
    const phaseErrors = errorsForPhase(PUBLIC_CHECKOUT_PHASES[phaseIndex], errors) as PaymentFieldErrors
    payer.setFieldErrors(phaseErrors)
    const field = firstPaymentField(phaseErrors)
    if (field) return goToField(field)
    setPhaseIndex(nextPhaseIndex(phaseIndex, PUBLIC_CHECKOUT_PHASES.length))
  }

  function goBack() {
    setPhaseIndex(previousPhaseIndex(phaseIndex))
  }

  async function submitWith(cardToken?: string) {
    const { form } = payer
    const input: PublicCheckoutPaymentInput = {
      ...form,
      billingType,
      installments,
      creditCard: EMPTY_CREDIT_CARD,
      phone: digitsOnly(form.phone, 11),
      cpfCnpj: digitsOnly(form.cpfCnpj, 14),
      postalCode: digitsOnly(form.postalCode, 8),
      ...(cardToken ? { cardToken } : {}),
    }
    lastInputRef.current = input
    try {
      await onSubmit(input)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Erro ao gerar pagamento"
      toast.error(
        message === "Endereço incompleto" ? "Preencha CEP, número, endereço, bairro, cidade e estado." : message,
      )
    }
  }

  /** Envio valida tudo; o primeiro erro leva à fase certa. O cartão precisa da fase de pagamento montada. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy || isLocked) return
    const errors = validate()
    payer.setFieldErrors(errors)
    const field = firstPaymentField(errors)
    if (field) return goToField(field)
    if (isCard && !isLastPhase) return setPhaseIndex(LAST_PHASE)

    let cardToken: string | undefined
    if (isCard) {
      const token = await card.tokenizeCard({
        fullName: payer.form.fullName,
        email: payer.form.email,
        cnpj: payer.form.cpfCnpj,
        phone: payer.form.phone,
      })
      if (!token) return
      cardToken = token
    }
    await submitWith(cardToken)
  }

  /** Gera de novo o PIX com a mesma tentativa de pagamento; reinicia o tempo da tentativa. */
  async function handleRegeneratePix() {
    if (isRegeneratingPix) return
    setIsRegeneratingPix(true)
    try {
      const input = lastInputRef.current
      if (input) await onSubmit(input)
      const start = Date.now()
      window.sessionStorage.setItem(attemptStorageKey, String(start))
      setAttemptStartedAt(start)
      setNow(start)
    } catch (regenerateError) {
      toast.error(regenerateError instanceof Error ? regenerateError.message : "Não foi possível gerar um novo PIX.")
    } finally {
      setIsRegeneratingPix(false)
    }
  }

  async function validatePayment() {
    if (!onRefreshStatus || isValidatingPayment) return
    setIsValidatingPayment(true)
    try {
      await onRefreshStatus({ sync: true })
    } finally {
      setIsValidatingPayment(false)
    }
  }

  const submitLabel = card.isTokenizing
    ? "Validando o cartão..."
    : isSubmitting
      ? "Gerando pagamento..."
      : isCard
        ? "Pagar com cartão"
        : "Gerar QR Code PIX"
  const payCaption = isCard ? (installments > 1 ? `em ${installments}x no cartão` : "no cartão") : "à vista no PIX"
  const securityText = isCard
    ? "Seus dados do cartão são enviados com segurança e não ficam salvos conosco."
    : "O QR Code vale por tempo limitado. O acesso chega por e-mail após a confirmação."

  function renderPhase(index: number) {
    if (!details) return null
    if (index === 0) return <PublicCheckoutSummaryStep details={details} />
    return (
      <PublicCheckoutPaymentStep
        form={payer.form}
        errors={payer.fieldErrors}
        disabled={isLocked}
        addressLocked={isLocked || !payer.cepResolved}
        showAddress={requiresAddress}
        onFieldChange={payer.setField}
      >
        {isCard && abacatePublicKey ? (
          <PublicCheckoutCardSection
            publicKey={abacatePublicKey}
            amountInCents={Math.round(cardTotal * 100)}
            cardFieldRef={card.cardFieldRef}
            error={card.cardError}
            disabled={isBusy}
            total={cardTotal}
            maxInstallments={maxInstallments}
            installments={installments}
            onInstallmentsChange={card.setInstallmentsChoice}
            installmentSchedule={details.installmentSplitMode === "CUSTOM" ? details.installmentSchedule : null}
          />
        ) : null}
      </PublicCheckoutPaymentStep>
    )
  }

  function renderOutcome() {
    if (payment?.pix) {
      return (
        <div className="flex flex-col gap-3">
          <CheckoutPixPayment
            pix={payment.pix}
            email={payerEmail || null}
            now={now}
            isExpired={isPixExpiredNow}
            isValidating={isValidatingPayment}
            isRegenerating={isRegeneratingPix}
            onValidate={() => void validatePayment()}
            onRegenerate={() => void handleRegeneratePix()}
          />
          {provider ? <p className="text-center text-xs text-muted-foreground">{getProviderBranding(provider).label}</p> : null}
        </div>
      )
    }
    if (payment?.billingType === "CREDIT_CARD" && payment.status === "pending") {
      return (
        <p role="status" className="text-sm text-muted-foreground">
          Pagamento enviado. Aguardando confirmação do banco.
        </p>
      )
    }
    return null
  }

  if (isPaid && details) {
    return (
      <PublicCheckoutShell variant="light" provider={provider} issuedLabel={details.issuedLabel} issuedValue={details.issuedValue}>
        <ForceLightDocument />
        {successVariant === "addon" ? (
          <CheckoutSuccess
            variant="addon"
            email={payerEmail}
            planLabel={details.includedTitle}
            paymentLabel={isCard ? `Cartão de crédito em ${installments}x` : "PIX à vista"}
            total={orderTotal}
            ctaHref={successHref}
          />
        ) : (
          <CheckoutSuccess
            companyName=""
            email={payerEmail}
            planLabel={details.includedTitle}
            paymentLabel={isCard ? `Cartão de crédito em ${installments}x` : "PIX à vista"}
            total={orderTotal}
          />
        )}
        {successDescription ? (
          <p className="mx-auto max-w-xl text-center text-sm text-muted-foreground">{successDescription}</p>
        ) : null}
      </PublicCheckoutShell>
    )
  }

  return (
    <PublicCheckoutShell variant="light" provider={provider} issuedLabel={details?.issuedLabel} issuedValue={details?.issuedValue}>
      <ForceLightDocument />

      {isLoading ? <SelfCheckoutSkeleton /> : null}

      {!isLoading && error ? <SelfCheckoutLoadError message={error} onRetry={onRetry ?? reloadPage} /> : null}

      {!isLoading && !error && !details ? <SelfCheckoutUnavailable /> : null}

      {!isLoading && !error && details && isAttemptExpired ? (
        <Alert>
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Tempo expirado</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {canRegeneratePix ? (
              <>
                <span>O tempo para pagar este PIX acabou. Gere um novo PIX para concluir a compra.</span>
                <Button type="button" className="w-fit max-lg:min-h-11" onClick={() => void handleRegeneratePix()} disabled={isRegeneratingPix}>
                  {isRegeneratingPix ? "Gerando..." : "Gerar novo PIX"}
                </Button>
              </>
            ) : (
              "O link expirou. Solicite um novo checkout com o suporte."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && details && !isAttemptExpired ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
              {details.title}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">{details.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-6">
              {payment ? (
                renderOutcome()
              ) : (
                <>
                  <CheckoutStepper labels={PUBLIC_CHECKOUT_PHASES.map((phase) => phase.label)} currentIndex={phaseIndex}>
                    {renderPhase(phaseIndex)}
                  </CheckoutStepper>
                  <CheckoutPhaseNav
                    onBack={phaseIndex > 0 ? goBack : undefined}
                    onNext={isLastPhase ? undefined : goNext}
                    disabled={isBusy}
                  />
                </>
              )}
            </div>

            <aside aria-label="Resumo do pedido" className="flex flex-col gap-4 lg:sticky lg:top-6">
              {!payment && offeredMethods.length > 0 ? (
                <CheckoutPaymentMethod
                  methods={offeredMethods}
                  value={billingType}
                  pixTotal={pixTotal}
                  cardTotal={cardTotal}
                  pixSavings={Math.max(0, cardTotal - pixTotal)}
                  maxInstallments={Math.max(1, maxInstallmentsOfContract)}
                  disabled={isLocked}
                  onChange={setChosenBillingType}
                />
              ) : null}

              <CheckoutOrderSummary
                footer={
                  payment ? null : (
                    <div className="flex flex-col gap-3">
                      <CheckoutTermsNotice />
                      <Button type="submit" size="lg" className="w-full max-lg:hidden" disabled={isBusy} aria-busy={isBusy}>
                        {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
                        {submitLabel}
                      </Button>
                      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        {securityText}
                      </p>
                    </div>
                  )
                }
              >
                <PublicCheckoutTotals details={details} billingType={billingType} installments={installments} />
              </CheckoutOrderSummary>
            </aside>

            {/* Celular: total e ação sempre à vista. Nas fases intermediárias a ação é Continuar. */}
            {payment ? null : (
              <CheckoutMobilePayBar
                total={orderTotal}
                caption={payCaption}
                label={isLastPhase ? submitLabel : "Continuar"}
                isBusy={isBusy}
                disabled={isBusy}
                onContinue={isLastPhase ? undefined : goNext}
              />
            )}
          </form>
        </>
      ) : null}
    </PublicCheckoutShell>
  )
}
