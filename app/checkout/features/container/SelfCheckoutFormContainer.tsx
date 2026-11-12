"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type RefObject } from "react"
import { Info, Loader2, Lock } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import {
  AbacateCardField,
  type AbacateCardFieldHandle,
} from "@/app/adesao/[token]/features/components/AbacateCardField"
import { AdhesionInstallmentsField } from "@/app/adesao/[token]/features/components/AdhesionPaymentFields"
import { toCents } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import { useAbacateCard } from "@/app/adesao/[token]/features/context/AbacateCardHook"
import { PublicAdhesionProvider } from "@/app/adesao/[token]/features/context/PublicAdhesionContext"
import { buildAdhesionCheckoutInput } from "@/app/adesao/[token]/features/utils/adhesionCheckoutInput"
import type { PublicAdhesionCheckoutInput } from "@/app/adesao/[token]/features/context/PublicAdhesionTypes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SelfCheckoutAddons } from "../components/SelfCheckoutAddons"
import { SelfCheckoutBuyerFields } from "../components/SelfCheckoutBuyerFields"
import { SelfCheckoutCoupon } from "../components/SelfCheckoutCoupon"
import { SelfCheckoutCycleSelector } from "../components/SelfCheckoutCycleSelector"
import { SelfCheckoutHoneypot } from "../components/SelfCheckoutHoneypot"
import { SelfCheckoutOrderBreakdown } from "../components/SelfCheckoutOrderBreakdown"
import { SelfCheckoutPaymentMethod } from "../components/SelfCheckoutPaymentMethod"
import { SelfCheckoutSubmitFailureAlert } from "../components/SelfCheckoutSubmitFailureAlert"
import { SelfCheckoutTermsAcceptance } from "../components/SelfCheckoutTermsAcceptance"
import { useSelfCheckout } from "../context/SelfCheckoutHook"
import type { SelfCheckoutFieldName } from "../context/SelfCheckoutTypes"
import type {
  SelfCheckoutBillingType,
  SelfCheckoutCouponQuote,
  SelfCheckoutCycleOption,
} from "@/lib/self-checkout/contracts"
import { SelfCheckoutMobilePayBar } from "../components/SelfCheckoutMobilePayBar"
import { SelfCheckoutOrderSummaryCard } from "../components/SelfCheckoutOrderSummaryCard"
import { SelfCheckoutPaymentStage } from "./SelfCheckoutPaymentStage"
import { AdhesionSuccessScreen } from "@/app/adesao/[token]/features/components/AdhesionSuccessScreen"
import { computeOrderAmounts, formatBRL } from "../utils/selfCheckoutForm"

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

function StepHeading({ number, id, title, description }: { number: number; id: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary"
        >
          {number}
        </span>
        <h2 id={id} className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
      </div>
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
      <StepHeading
        number={3}
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
      <AdhesionInstallmentsField
        total={total}
        maxInstallments={maxInstallments}
        fixedSchedule={null}
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
      <AdhesionSuccessScreen
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
          <SelfCheckoutOrderSummaryCard companyName={companyName} cnpj={cnpj}>
            <SelfCheckoutOrderBreakdown
              option={option}
              billingType={billingType}
              couponQuote={couponQuote}
              extraUsers={extras.extraUsers}
              extraTeams={extras.extraTeams}
              installments={isCard ? installments : undefined}
            />
          </SelfCheckoutOrderSummaryCard>
        }
      />
    </PublicAdhesionProvider>
  )
}

/**
 * Contratação em uma tela só: período, dados da empresa e pagamento, com o resumo sempre à vista.
 * O pedido é criado ao enviar; depois disso o pagamento é gerado na mesma tela.
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy) return
    if (orderToken) {
      // Pedido já criado: só o pagamento é enviado de novo, com um cartão novo ou corrigido.
      if (isCard && !(await tokenizeCard())) return
      return retryPayment()
    }
    const companyInvalid = validate()
    if (companyInvalid) return focusElement(FIELD_ELEMENT_ID[companyInvalid])
    if (isCard && !(await tokenizeCard())) return
    const outcome = await submit()
    if (outcome.kind === "invalid") focusElement(FIELD_ELEMENT_ID[outcome.firstInvalidField])
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
        onEditCard={() => setIsEditingPayment(true)}
        onPayWithPix={() => {
          setBillingType("PIX")
          retryPayment()
        }}
      />
    )
  }

  const locked = isBusy || Boolean(orderToken)

  return (
    <div className="flex w-full flex-col gap-8 max-lg:pb-20">
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
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <SelfCheckoutCycleSelector
              cycles={options.cycles}
              value={selectedCycle}
              billingType={values.billingType}
              onChange={selectCycle}
              disabled={locked}
              error={fieldErrors.cycle}
            />
            <SelfCheckoutAddons
              option={selectedOption}
              extraUsers={values.extraUsers}
              extraTeams={values.extraTeams}
              disabled={locked}
              onChange={setExtraQuantity}
            />
          </div>

          <section aria-labelledby="self-checkout-data-title" className="flex flex-col gap-5">
            <StepHeading
              number={2}
              id="self-checkout-data-title"
              title="Seus dados"
              description="Campos marcados com * são obrigatórios."
            />
            <SelfCheckoutBuyerFields
              values={values}
              errors={fieldErrors}
              disabled={locked}
              onChange={setFieldValue}
              onFieldBlur={markFieldTouched}
              isLookingUpCompany={isLookingUpCompany}
            />
          </section>

          {isCard && options.cardCheckout ? (
            <CardPaymentSection
              cardFieldRef={cardFieldRef}
              publicKey={options.cardCheckout.publicKey}
              total={cardTotal}
              maxInstallments={maxInstallments}
              installments={installments}
              error={cardError}
              disabled={isBusy}
              onInstallmentsChange={setInstallmentsChoice}
            />
          ) : null}
        </div>

        <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="gap-1 border-b border-border px-6 py-5">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Resumo do pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-6 py-5">
              {selectedOption ? (
                <SelfCheckoutPaymentMethod
                  option={selectedOption}
                  value={values.billingType}
                  onChange={setBillingType}
                  disabled={isBusy}
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
                  disabled={locked}
                  onInputChange={setCouponInput}
                  onApply={() => void applyCoupon()}
                  onRemove={removeCoupon}
                />
              ) : null}

              <Separator />

              <>
                  <SelfCheckoutTermsAcceptance
                    checked={values.termsAccepted}
                    error={fieldErrors.termsAccepted}
                    disabled={isBusy}
                    onChange={setTermsAccepted}
                  />

                  <SelfCheckoutHoneypot value={values.website} onChange={(next) => setFieldValue("website", next)} />

                  {submitFailure ? <SelfCheckoutSubmitFailureAlert failure={submitFailure} /> : null}

                  <div className="flex flex-col gap-3">
                    {/* No celular o botão fica na barra fixa do rodapé, junto com o total. */}
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full max-lg:hidden"
                      disabled={isBusy}
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
                  </div>
              </>
            </CardContent>
          </Card>
        </aside>

        {/* Celular: total e botão sempre à vista, sem precisar rolar até o fim da página. */}
        {(orderToken && !isEditingPayment) || orderTotal == null ? null : (
          <SelfCheckoutMobilePayBar
            total={orderTotal}
            caption={payCaption(isCard, installments)}
            label={submitText}
            isBusy={isBusy}
            disabled={isBusy}
          />
        )}
      </form>
    </div>
  )
}
