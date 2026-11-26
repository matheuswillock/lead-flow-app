"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type RefObject } from "react"
import { Info, Loader2, Lock } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import {
  AbacateCardField,
  type AbacateCardFieldHandle,
} from "@/app/adesao/[token]/features/components/AbacateCardField"
import { toCents } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import { useAbacateCard } from "@/app/adesao/[token]/features/context/AbacateCardHook"
import { PublicAdhesionProvider } from "@/app/adesao/[token]/features/context/PublicAdhesionContext"
import { buildAdhesionCheckoutInput } from "@/app/adesao/[token]/features/utils/adhesionCheckoutInput"
import type { PublicAdhesionCheckoutInput } from "@/app/adesao/[token]/features/context/PublicAdhesionTypes"
import { CheckoutInstallmentsSelect } from "@/components/checkout/CheckoutInstallmentsSelect"
import { CheckoutPhaseNav } from "@/components/checkout/CheckoutPhaseNav"
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper"
import {
  clampPhaseIndex,
  nextPhaseIndex,
  phaseIndexForField,
  previousPhaseIndex,
} from "@/components/checkout/checkoutPhases"
import { Button } from "@/components/ui/button"
import { SelfCheckoutAddons } from "../components/SelfCheckoutAddons"
import { SelfCheckoutBuyerFields } from "../components/SelfCheckoutBuyerFields"
import { SelfCheckoutCoupon } from "../components/SelfCheckoutCoupon"
import { SelfCheckoutCycleSelector } from "../components/SelfCheckoutCycleSelector"
import { SelfCheckoutHoneypot } from "../components/SelfCheckoutHoneypot"
import { SelfCheckoutOrderBreakdown } from "../components/SelfCheckoutOrderBreakdown"
import { SelfCheckoutSubmitFailureAlert } from "../components/SelfCheckoutSubmitFailureAlert"
import { SelfCheckoutTermsAcceptance } from "../components/SelfCheckoutTermsAcceptance"
import { useSelfCheckout } from "../context/SelfCheckoutHook"
import type { SelfCheckoutFieldName } from "../context/SelfCheckoutTypes"
import type {
  SelfCheckoutBillingType,
  SelfCheckoutCouponQuote,
  SelfCheckoutCycleOption,
} from "@/lib/self-checkout/contracts"
import { SelfCheckoutPaymentStage } from "./SelfCheckoutPaymentStage"
import { CheckoutMobilePayBar } from "@/components/checkout/CheckoutMobilePayBar"
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary"
import { CheckoutPaymentMethod } from "@/components/checkout/CheckoutPaymentMethod"
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess"
import { pixSavingsAmount } from "@/components/checkout/checkoutPaymentMath"
import { computeOrderAmounts, formatBRL } from "../utils/selfCheckoutForm"
import {
  isPayBlockedByTerms,
  isTermsAcceptanceRequired,
  MOBILE_TERMS_HINT,
  termsHintFor,
} from "../utils/selfCheckoutTermsGate"
import { formatDocumentInput } from "@/lib/masks"

type PhaseId = "plan" | "data" | "card"

const PHASE_LABEL: Record<PhaseId, string> = {
  plan: "Período do plano",
  data: "Seus dados",
  card: "Dados do cartão",
}

/** Campos que cada fase valida ao continuar. Termos e honeypot ficam na lateral. */
const PHASE_FIELDS: Record<PhaseId, SelfCheckoutFieldName[]> = {
  plan: ["cycle"],
  data: ["cnpj", "phone", "companyLegalName", "companyTradeName", "fullName", "email"],
  card: [],
}

function maxInstallmentsOf(option: SelfCheckoutCycleOption | null): number {
  return Math.max(1, option?.maxInstallments ?? option?.months ?? 1)
}

/** Endereço não é pedido: o PIX e o cartão do Abacate Pay dispensam. */
const NO_ADDRESS = {
  postalCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
}

function submitLabelFor(state: { isTokenizing: boolean; isBusy: boolean; isCard: boolean; isRetry: boolean }): string {
  if (state.isTokenizing) return "Validando o cartão..."
  if (state.isBusy) return "Criando seu pedido..."
  if (!state.isCard) return "Gerar QR Code PIX"
  return state.isRetry ? "Tentar pagar de novo" : "Pagar com cartão"
}

function planLabelFor(option: SelfCheckoutCycleOption): string {
  return option.months > 1 ? `${option.label} (${option.months} meses)` : option.label
}

function installmentsLabelFor(total: number, installments: number): string {
  if (installments <= 1) return `1x de ${formatBRL(total)}`
  return `${installments}x de ${formatBRL(Math.round((total / installments) * 100) / 100)}`
}

function payCaption(isCard: boolean, installments: number): string {
  if (!isCard) return "à vista no PIX"
  return installments > 1 ? `em ${installments}x no cartão` : "no cartão"
}

/** Total na forma escolhida: o cupom vale só para o plano e os adicionais entram por cima. */
function orderTotalFor(
  option: SelfCheckoutCycleOption | null,
  billingType: SelfCheckoutBillingType,
  extras: { extraUsers: number; extraTeams: number },
  couponQuote: SelfCheckoutCouponQuote | null,
): number | null {
  if (!option) return null
  const amounts = computeOrderAmounts(option, billingType, extras)
  return couponQuote ? couponQuote.totalAfterDiscount + amounts.extrasTotal : amounts.total
}

const FIELD_ELEMENT_ID: Record<SelfCheckoutFieldName, string> = {
  cycle: "self-checkout-cycles-title",
  companyLegalName: "self-checkout-companyLegalName",
  companyTradeName: "self-checkout-companyTradeName",
  cnpj: "self-checkout-cnpj",
  fullName: "self-checkout-fullName",
  email: "self-checkout-email",
  phone: "self-checkout-phone",
  termsAccepted: "self-checkout-terms",
}

const TERMS_HINT_ID = "self-checkout-terms-hint"

function focusElement(id: string) {
  const element = document.getElementById(id)
  if (!element) return
  element.scrollIntoView({ block: "center" })
  if (id === FIELD_ELEMENT_ID.cycle) {
    document.querySelector<HTMLElement>('[role="radio"]')?.focus()
    return
  }
  element.focus()
}

/** A fase nova só monta depois da animação de saída; espera o campo aparecer antes de focar. */
function focusWhenReady(id: string, attempts = 30) {
  if (document.getElementById(id)) return focusElement(id)
  if (attempts > 0) requestAnimationFrame(() => focusWhenReady(id, attempts - 1))
}

/** Quem contrata, no topo do resumo do pedido criado. */
function CompanyHeader({ companyName, cnpj }: { companyName: string; cnpj: string }) {
  const cnpjDigits = cnpj.replace(/\D/g, "")
  if (!companyName) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="break-words font-display text-lg font-bold text-foreground">{companyName}</span>
      {cnpjDigits.length === 14 ? (
        <span className="text-sm text-muted-foreground tabular-nums">CNPJ {formatDocumentInput(cnpjDigits)}</span>
      ) : null}
    </div>
  )
}

function PhaseHeading({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 id={id} className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Cartão pelo Abacate Pay: formulário seguro (iframe) e escolha de parcelas. */
function CardPaymentSection({
  cardFieldRef,
  publicKey,
  total,
  maxInstallments,
  installments,
  error,
  disabled,
  onInstallmentsChange,
}: {
  cardFieldRef: RefObject<AbacateCardFieldHandle | null>
  publicKey: string
  total: number
  maxInstallments: number
  installments: number
  error: string | null
  disabled: boolean
  onInstallmentsChange: (installments: number) => void
}) {
  return (
    <section aria-labelledby="adhesion-card-title" className="flex flex-col gap-5">
      <PhaseHeading
        id="adhesion-card-title"
        title="Dados do cartão"
        description="Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app."
      />
      <AbacateCardField ref={cardFieldRef} publicKey={publicKey} amountInCents={toCents(total)} />
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <CheckoutInstallmentsSelect
        total={total}
        maxInstallments={maxInstallments}
        value={installments}
        disabled={disabled}
        onChange={onInstallmentsChange}
      />
    </section>
  )
}

/** Depois de criado o pedido: a etapa de pagamento e, ao confirmar, o fechamento da contratação. */
function OrderOutcome({
  isPaid,
  orderToken,
  paymentAttempt,
  option,
  companyName,
  email,
  cnpj,
  billingType,
  couponQuote,
  extras,
  installments,
  total,
  paymentInput,
  cardLastFour,
  onPaid,
  onEditCard,
  onPayWithPix,
}: {
  isPaid: boolean
  orderToken: string | null
  paymentAttempt: number
  option: SelfCheckoutCycleOption
  companyName: string
  email: string
  cnpj: string
  billingType: SelfCheckoutBillingType
  couponQuote: SelfCheckoutCouponQuote | null
  extras: { extraUsers: number; extraTeams: number }
  installments: number
  total: number
  paymentInput: PublicAdhesionCheckoutInput
  cardLastFour: string | null
  onPaid: () => void
  onEditCard: () => void
  onPayWithPix: () => void
}) {
  const isCard = billingType === "CREDIT_CARD"
  if (isPaid || !orderToken) {
    return (
      <CheckoutSuccess
        companyName={companyName}
        email={email}
        planLabel={planLabelFor(option)}
        paymentLabel={isCard ? `Cartão de crédito em ${installments}x` : "PIX à vista"}
        total={total}
      />
    )
  }

  return (
    <PublicAdhesionProvider key={paymentAttempt} token={orderToken}>
      <SelfCheckoutPaymentStage
        input={paymentInput}
        installmentsLabel={installmentsLabelFor(total, installments)}
        cardLastFour={cardLastFour}
        onPaid={onPaid}
        onEditCard={onEditCard}
        onPayWithPix={onPayWithPix}
        summary={
          <CheckoutOrderSummary header={<CompanyHeader companyName={companyName} cnpj={cnpj} />}>
            <SelfCheckoutOrderBreakdown
              option={option}
              billingType={billingType}
              couponQuote={couponQuote}
              extraUsers={extras.extraUsers}
              extraTeams={extras.extraTeams}
              installments={isCard ? installments : undefined}
            />
          </CheckoutOrderSummary>
        }
      />
    </PublicAdhesionProvider>
  )
}

/**
 * Contratação em fases: período do plano, seus dados e, no cartão, os dados do cartão. O resumo
 * e a forma de pagamento ficam sempre na lateral. O pedido é criado ao enviar; depois disso o
 * pagamento é gerado na mesma tela.
 */
export function SelfCheckoutFormContainer() {
  const {
    options,
    selectedCycle,
    values,
    fieldErrors,
    submitFailure,
    isSubmitting,
    isRedirecting,
    isLookingUpCompany,
    orderToken,
    selectCycle,
    setFieldValue,
    setExtraQuantity,
    markFieldTouched,
    setTermsAccepted,
    setBillingType,
    couponInput,
    couponStatus,
    couponQuote,
    couponMessage,
    setCouponInput,
    applyCoupon,
    removeCoupon,
    validate,
    validatePhase,
    submit,
  } = useSelfCheckout()

  const isCard = values.billingType === "CREDIT_CARD"
  // Cartão do Abacate Pay: os dados ficam no iframe seguro; aqui só parcelas e o token gerado.
  const {
    cardFieldRef,
    installmentsChoice,
    setInstallmentsChoice,
    cardToken,
    cardLastFour,
    cardError,
    isTokenizing,
    tokenizeCard: tokenizeWithPayer,
  } = useAbacateCard()
  const [isPaid, setIsPaid] = useState(false)
  const handlePaid = useCallback(() => setIsPaid(true), [])
  // Cartão recusado: o cliente volta ao formulário para corrigir o pagamento, no mesmo pedido.
  const [isEditingPayment, setIsEditingPayment] = useState(false)
  // Cada nova tentativa remonta a etapa de pagamento, que gera a cobrança de novo.
  const [paymentAttempt, setPaymentAttempt] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)

  // Ao trocar entre formulário e pagamento a página volta ao topo.
  useEffect(() => {
    if (!orderToken) return
    // Corrigindo o cartão: vai direto aos dados do cartão; nos outros casos, ao topo da etapa.
    const cardSection = isEditingPayment ? document.getElementById("adhesion-card-title") : null
    if (cardSection) cardSection.scrollIntoView({ block: "start" })
    else window.scrollTo({ top: 0 })
  }, [orderToken, isEditingPayment, paymentAttempt])

  const selectedOption = options?.cycles.find((option) => option.cycle === selectedCycle) ?? null
  // Depois de criado o pedido (isRedirecting), só o pagamento continua editável.
  const isBusy = isSubmitting || isTokenizing || (isRedirecting && !isEditingPayment)
  const maxInstallments = maxInstallmentsOf(selectedOption)
  const installments = isCard ? Math.min(installmentsChoice, maxInstallments) : 1

  const paymentInput = useMemo(
    () =>
      buildAdhesionCheckoutInput({
        payer: { fullName: values.fullName, email: values.email, phone: values.phone, cpfCnpj: values.cnpj },
        values: NO_ADDRESS,
        billingType: values.billingType,
        installments,
        cardToken,
      }),
    [cardToken, installments, values.billingType, values.cnpj, values.email, values.fullName, values.phone],
  )

  if (!options) return null

  const offersCard = options.cycles.some((option) => Boolean(option.creditCardTotal))
  const extras = { extraUsers: values.extraUsers, extraTeams: values.extraTeams }
  const cardTotal = orderTotalFor(selectedOption, "CREDIT_CARD", extras, couponQuote) ?? 0
  const orderTotal = orderTotalFor(selectedOption, values.billingType, extras, couponQuote)
  const submitText = submitLabelFor({ isTokenizing, isBusy, isCard, isRetry: isEditingPayment })
  const companyName = values.companyTradeName.trim() || values.companyLegalName.trim()

  // Fases da forma escolhida: no cartão há uma fase a mais, a dos dados do cartão.
  const hasCardPhase = isCard && Boolean(options.cardCheckout)
  const phaseIds: PhaseId[] = hasCardPhase ? ["plan", "data", "card"] : ["plan", "data"]
  const phases = phaseIds.map((id) => ({ label: PHASE_LABEL[id], fields: PHASE_FIELDS[id] }))
  const cycles = options.cycles
  const cardPublicKey = options.cardCheckout?.publicKey ?? null
  const activePhaseIndex = clampPhaseIndex(phaseIndex, phaseIds.length)
  const activePhaseId = phaseIds[activePhaseIndex]
  const isLastPhase = activePhaseIndex === phaseIds.length - 1
  const isLocked = isBusy || Boolean(orderToken)
  const payBlockedByTerms = isPayBlockedByTerms({ termsAccepted: values.termsAccepted, hasOrder: Boolean(orderToken) })

  function retryPayment() {
    setIsEditingPayment(false)
    setPaymentAttempt((current) => current + 1)
  }

  /** Gera o token do cartão no envio; se falhar, leva o cliente de volta aos dados do cartão. */
  async function tokenizeCard(): Promise<boolean> {
    const token = await tokenizeWithPayer(values)
    if (!token) focusElement("adhesion-card-title")
    return Boolean(token)
  }

  /** Leva à fase do campo com erro e foca o campo. Termos ficam na lateral, então não mudam de fase. */
  function goToField(field: SelfCheckoutFieldName) {
    const index = phaseIndexForField(phases, field)
    if (index >= 0) setPhaseIndex(index)
    focusWhenReady(FIELD_ELEMENT_ID[field])
  }

  function goNext() {
    const invalidField = validatePhase(PHASE_FIELDS[activePhaseId])
    if (invalidField) return focusWhenReady(FIELD_ELEMENT_ID[invalidField])
    setPhaseIndex(nextPhaseIndex(activePhaseIndex, phaseIds.length))
  }

  function goBack() {
    setPhaseIndex(previousPhaseIndex(activePhaseIndex))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy) return
    if (orderToken) {
      // Pedido já criado: só o pagamento é enviado de novo, com um cartão novo ou corrigido.
      if (isCard && !(await tokenizeCard())) return
      return retryPayment()
    }
    const invalidField = validate()
    if (invalidField) return goToField(invalidField)
    // No cartão, o pagamento só é enviado da fase dos dados do cartão.
    if (hasCardPhase && activePhaseId !== "card") return setPhaseIndex(phaseIds.length - 1)
    if (isCard && !(await tokenizeCard())) return
    const outcome = await submit()
    if (outcome.kind === "invalid") goToField(outcome.firstInvalidField)
  }

  const showOutcome = isPaid || (Boolean(orderToken) && !isEditingPayment)
  if (showOutcome && selectedOption) {
    return (
      <OrderOutcome
        isPaid={isPaid}
        orderToken={orderToken}
        paymentAttempt={paymentAttempt}
        option={selectedOption}
        companyName={companyName}
        email={values.email.trim()}
        cnpj={values.cnpj}
        billingType={values.billingType}
        couponQuote={couponQuote}
        extras={extras}
        installments={installments}
        total={orderTotal ?? 0}
        paymentInput={paymentInput}
        cardLastFour={cardLastFour}
        onPaid={handlePaid}
        onEditCard={() => {
          setIsEditingPayment(true)
          setPhaseIndex(phaseIds.length - 1)
        }}
        onPayWithPix={() => {
          setBillingType("PIX")
          retryPayment()
        }}
      />
    )
  }

  function renderPhase(id: PhaseId) {
    if (id === "plan") {
      return (
        <div className="flex flex-col gap-6">
          <SelfCheckoutCycleSelector
            cycles={cycles}
            value={selectedCycle}
            billingType={values.billingType}
            onChange={selectCycle}
            disabled={isLocked}
            error={fieldErrors.cycle}
          />
          <SelfCheckoutAddons
            option={selectedOption}
            extraUsers={values.extraUsers}
            extraTeams={values.extraTeams}
            disabled={isLocked}
            onChange={setExtraQuantity}
          />
        </div>
      )
    }
    if (id === "data") {
      return (
        <section aria-labelledby="self-checkout-data-title" className="flex flex-col gap-5">
          <PhaseHeading
            id="self-checkout-data-title"
            title="Seus dados"
            description="Campos marcados com * são obrigatórios."
          />
          <SelfCheckoutBuyerFields
            values={values}
            errors={fieldErrors}
            disabled={isLocked}
            onChange={setFieldValue}
            onFieldBlur={markFieldTouched}
            isLookingUpCompany={isLookingUpCompany}
          />
        </section>
      )
    }
    return (
      <CardPaymentSection
        cardFieldRef={cardFieldRef}
        publicKey={cardPublicKey ?? ""}
        total={cardTotal}
        maxInstallments={maxInstallments}
        installments={installments}
        error={cardError}
        disabled={isBusy}
        onInstallmentsChange={setInstallmentsChoice}
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
          Contrate o Corretor Studio
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {offersCard ? "Pague por PIX ou cartão e receba o acesso por e-mail." : "Pague por PIX e receba o acesso por e-mail."}
        </p>
      </div>

      {isEditingPayment ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>Seu pedido continua reservado</AlertTitle>
          <AlertDescription>
            Corrija os dados do cartão ou escolha PIX no resumo. Os dados da empresa já foram salvos.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <CheckoutStepper labels={phases.map((phase) => phase.label)} currentIndex={activePhaseIndex}>
            {renderPhase(activePhaseId)}
          </CheckoutStepper>

          {orderToken ? null : (
            <CheckoutPhaseNav
              onBack={activePhaseIndex > 0 ? goBack : undefined}
              onNext={isLastPhase ? undefined : goNext}
              disabled={isBusy}
            />
          )}
        </div>

        <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
          <CheckoutOrderSummary
            footer={
              <>
                {/* Com o pedido criado o aceite já foi enviado (o servidor o exige): o retry não pede de novo. */}
                {isTermsAcceptanceRequired({ hasOrder: Boolean(orderToken) }) ? (
                  <SelfCheckoutTermsAcceptance
                    checked={values.termsAccepted}
                    error={fieldErrors.termsAccepted}
                    disabled={isBusy}
                    onChange={setTermsAccepted}
                  />
                ) : null}

                <SelfCheckoutHoneypot value={values.website} onChange={(next) => setFieldValue("website", next)} />

                {submitFailure ? <SelfCheckoutSubmitFailureAlert failure={submitFailure} /> : null}

                <div className="flex flex-col gap-3">
                  {/* No celular o botão fica na barra fixa do rodapé, junto com o total. */}
                  {payBlockedByTerms ? (
                    <p id={TERMS_HINT_ID} className="text-center text-sm text-muted-foreground max-lg:hidden">
                      {termsHintFor(isCard)}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full max-lg:hidden"
                    disabled={isBusy || payBlockedByTerms}
                    aria-busy={isBusy}
                    aria-describedby={payBlockedByTerms ? TERMS_HINT_ID : undefined}
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
                </div>
              </>
            }
          >
            {selectedOption?.creditCardTotal ? (
              <CheckoutPaymentMethod
                methods={["PIX", "CREDIT_CARD"]}
                value={values.billingType}
                pixTotal={selectedOption.pixTotal}
                cardTotal={selectedOption.creditCardTotal}
                pixSavings={pixSavingsAmount(selectedOption)}
                maxInstallments={maxInstallments}
                disabled={isBusy}
                onChange={setBillingType}
              />
            ) : null}

            {selectedOption ? (
              <SelfCheckoutOrderBreakdown
                option={selectedOption}
                billingType={values.billingType}
                couponQuote={couponQuote}
                extraUsers={values.extraUsers}
                extraTeams={values.extraTeams}
                installments={isCard ? installments : undefined}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um período para ver o total.</p>
            )}

            {options.couponsEnabled && selectedOption && !orderToken ? (
              <SelfCheckoutCoupon
                input={couponInput}
                status={couponStatus}
                quote={couponQuote}
                message={couponMessage}
                disabled={isLocked}
                onInputChange={setCouponInput}
                onApply={() => void applyCoupon()}
                onRemove={removeCoupon}
              />
            ) : null}
          </CheckoutOrderSummary>
        </aside>

        {/* Celular: total e ação sempre à vista. Nas fases intermediárias a ação é Continuar. */}
        {(orderToken && !isEditingPayment) || orderTotal == null ? null : (
          <CheckoutMobilePayBar
            total={orderTotal}
            caption={payCaption(isCard, installments)}
            label={isLastPhase ? submitText : "Continuar"}
            isBusy={isBusy}
            // "Continuar" só avança de fase, então só a última fase (a que paga) espera o aceite.
            disabled={isBusy || (isLastPhase && payBlockedByTerms)}
            onContinue={isLastPhase ? undefined : goNext}
            hint={
              isLastPhase && payBlockedByTerms
                ? { label: MOBILE_TERMS_HINT, onAction: () => focusElement(FIELD_ELEMENT_ID.termsAccepted) }
                : undefined
            }
          />
        )}
      </form>
    </div>
  )
}
