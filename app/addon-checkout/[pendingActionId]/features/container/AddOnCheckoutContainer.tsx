"use client"

import { useCallback, useEffect, useMemo } from "react"

import { coerceBillingType, normalizeAvailableBillingTypes } from "@/lib/payment-methods/availability-client"
import { PublicCheckoutFlow } from "@/components/public-checkout/PublicCheckoutFlow"
import type { CheckoutPaymentProvider } from "@/components/public-checkout/providerBranding"
import type {
  PublicCheckoutDetails,
  PublicCheckoutPaymentView,
  PublicCheckoutPayerPrefill,
} from "@/components/public-checkout/publicCheckoutTypes"
import { useAddOnCheckout } from "../context/AddOnCheckoutHook"
import type { AddOnCheckoutSubmitInput } from "../context/AddOnCheckoutTypes"

const ATTEMPT_STORAGE_PREFIX = "addon-checkout-attempt-start:"
const PLATFORM_PURCHASE_SUCCESS_DESCRIPTION =
  "Os créditos são aplicados automaticamente em até 5 minutos."

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(value)
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function getAttemptStorageKey(pendingActionId: string): string {
  return `${ATTEMPT_STORAGE_PREFIX}${pendingActionId}`
}

interface AddOnCheckoutContainerProps {
  pendingActionId: string
  /** Entrada da conta logada, para onde a confirmação do add-on leva. */
  accountHref?: string
}

/** Meses podem ser fracionários (cobrança por dias): mostra até 2 casas, sem zeros à direita. */
function formatMonths(months: number): string {
  return months.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function AddOnCheckoutContainer({ pendingActionId, accountHref }: AddOnCheckoutContainerProps) {
  const { state, fetchCheckoutData, submitPayment, refreshPaymentStatus, clearPolling } = useAddOnCheckout()

  useEffect(() => {
    fetchCheckoutData(pendingActionId)
    return () => clearPolling()
  }, [pendingActionId, fetchCheckoutData, clearPolling])

  // Compras de plataforma usam AbacatePay; os fluxos legados seguem os métodos autorizados pelo servidor.
  const availableMethods = useMemo(
    () =>
      state.data?.checkoutSource === "platform_purchase"
        ? normalizeAvailableBillingTypes(state.data.availableBillingTypes)
        : normalizeAvailableBillingTypes(state.data?.availableBillingTypes),
    [state.data?.checkoutSource, state.data?.availableBillingTypes]
  )

  const mappedDetails = useMemo<PublicCheckoutDetails | null>(() => {
    const data = state.data
    if (!data) return null

    // Cartão indisponível nunca é o método pré-selecionado.
    const preset = coerceBillingType(data.presetBillingType, availableMethods)
    const startDate = new Date()
    const remainingMonths = data.pricing.remainingMonths ?? 1
    const dueDate = addMonths(startDate, Math.max(1, Math.ceil(remainingMonths)))
    const totalCharge = data.pricing.totalCharge ?? 0
    const isPlatformPurchase = data.checkoutSource === "platform_purchase"

    const title = "Finalizar compra"
    const subtitle = isPlatformPurchase
      ? data.purchaseType === "email_credits"
        ? `Créditos de e-mail — ${data.addonLabel}`
        : data.addonDetail || data.addonLabel
      : remainingMonths > 1
        ? `Cobrança proporcional por ${formatMonths(remainingMonths)} meses`
        : "Cobrança proporcional"

    const invoiceItems = [
      {
        icon: data.addonType === "team" ? ("team" as const) : ("users" as const),
        title: data.addonLabel,
        description: data.addonDetail,
        quantity: 1,
        unitAmountMonthly: data.pricing.monthlyPrice ?? 0,
        totalAmountMonthly: data.pricing.monthlyPrice ?? 0,
      },
    ]

    const compositionRows = isPlatformPurchase
      ? [
          { label: "Produto", value: data.addonLabel },
          ...(data.addonDetail ? [{ label: "Créditos", value: data.addonDetail }] : []),
          { label: "Ciclo", value: "Mensal" },
          { label: "Total", value: formatCurrency(totalCharge), emphasize: true },
        ]
      : [
          ...invoiceItems.map((item) => ({
            label: `${item.title} (${item.quantity}x)`,
            value: formatCurrency(item.totalAmountMonthly),
          })),
          {
            label: "Meses restantes",
            value: `${formatMonths(remainingMonths)} ${remainingMonths === 1 ? "mês" : "meses"}`,
          },
          { label: "Total", value: formatCurrency(totalCharge), emphasize: true },
        ]

    return {
      presetBillingType: preset,
      billingTypePrices: {
        PIX: { monthly: data.pricing.monthlyPrice ?? 0, total: totalCharge },
        CREDIT_CARD: { monthly: data.pricing.monthlyPrice ?? 0, total: totalCharge },
      },
      title,
      subtitle,
      includedTitle: data.addonLabel,
      includedSubtitle: data.activationHint ?? data.addonDetail,
      compositionTitle: "Seu plano",
      compositionRows,
      invoiceItems,
      invoiceSummary: {
        monthlyTotal: data.pricing.monthlyPrice ?? 0,
        totalDueNow: totalCharge,
        billingHint: preset === "CREDIT_CARD" ? "Cartão de crédito" : "PIX",
      },
      monthlyTotalLabel: "Total Mensal",
      monthlyTotalValue: `${formatCurrency(data.pricing.monthlyPrice)} / mês`,
      totalTitle: "TOTAL",
      totalSubtitle: isPlatformPurchase
        ? (data.activationHint ?? "A ativação acontece após confirmação do pagamento.")
        : "Pagamento único",
      totalValue: formatCurrency(totalCharge),
      totalHint: preset === "CREDIT_CARD"
        ? `em até ${Math.max(1, data.pricing.maxInstallments)}x no cartão`
        : "via PIX",
      startLabel: "Início",
      startValue: formatDate(startDate),
      dueLabel: "Vencimento",
      dueValue: formatDate(dueDate),
      // Rodapé sem data: o add-on é vendido pelo Corretor Studio, não emitido em uma data específica.
      issuedLabel: "Vendido por Corretor Studio",
      issuedValue: "",
    }
  }, [state.data, availableMethods])

  // Identidade estável: o auto-refresh do fluxo depende desta referência e de `mappedPayment`.
  const handleRefreshStatus = useCallback(() => refreshPaymentStatus(), [refreshPaymentStatus])

  const presetBillingType = state.data
    ? coerceBillingType(state.data.presetBillingType, availableMethods)
    : undefined
  const mappedPayment = useMemo<PublicCheckoutPaymentView | null>(() => {
    if (!presetBillingType) return null
    const paymentData = state.paymentData as any
    const paymentStatus = state.paymentStatus

    if (!paymentData && !paymentStatus && state.step !== "success") return null

    const isApplied = paymentStatus?.pendingActionStatus === "applied" || state.step === "success"
    const status = isApplied
      ? "paid"
      : paymentStatus?.pendingActionStatus === "canceled"
        ? "canceled"
        : paymentStatus?.pendingActionStatus === "failed"
          ? "error"
          : "pending"

    const amount = typeof paymentData?.amount === "number" ? paymentData.amount : typeof paymentData?.amountInCents === "number" ? paymentData.amountInCents / 100 : typeof paymentStatus?.amount === "number" ? paymentStatus.amount : 0

    return {
      status,
      billingType: presetBillingType,
      amountLabel: "Valor",
      amountValue: formatCurrency(amount),
      invoiceUrl: paymentData?.invoiceUrl ?? null,
      pix: paymentData?.pix ?? null,
    }
  }, [presetBillingType, state.paymentData, state.paymentStatus, state.step])

  const prefill = useMemo<PublicCheckoutPayerPrefill>(() => {
    const data = state.data
    const defaults = data?.defaultBillingData
    return {
      fullName: defaults?.fullName ?? "",
      email: defaults?.email ?? "",
      phone: defaults?.phone ?? "",
      cpfCnpj: defaults?.cpfCnpj ?? "",
      postalCode: defaults?.postalCode ?? "",
      address: defaults?.address ?? "",
      addressNumber: defaults?.addressNumber ?? "",
      neighborhood: defaults?.neighborhood ?? "",
      complement: defaults?.complement ?? "",
      city: defaults?.city ?? "",
      state: defaults?.state ?? "",
    }
  }, [state.data])

  const maxInstallments = state.data?.pricing.maxInstallments ?? 1

  const error = state.step === "error" ? state.error ?? "Erro ao carregar checkout" : null
  const isPlatformPurchase = state.data?.checkoutSource === "platform_purchase"
  const isLoading = state.step === "loading"
  const isSubmitting = state.isProcessing
  // platform_purchase usa AbacatePay; fluxos legados seguem no Asaas. Sem dados, sem marca.
  const provider: CheckoutPaymentProvider | null = state.data
    ? isPlatformPurchase
      ? "ABACATE_PAY"
      : "ASAAS"
    : null

  return (
    <PublicCheckoutFlow
      provider={provider}
      canRegeneratePix={isPlatformPurchase}
      attemptStorageKey={getAttemptStorageKey(pendingActionId)}
      details={mappedDetails}
      payment={mappedPayment}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      error={error}
      maxInstallments={maxInstallments}
      prefill={prefill}
      skipAddress={isPlatformPurchase}
      abacatePublicKey={state.data?.cardCheckout?.publicKey ?? null}
      availableMethods={availableMethods}
      successVariant="addon"
      successHref={accountHref}
      successDescription={isPlatformPurchase ? PLATFORM_PURCHASE_SUCCESS_DESCRIPTION : undefined}
      onRetry={() => void fetchCheckoutData(pendingActionId)}
      onSubmit={async (input) => {
        if (!mappedDetails) return
        const payload: AddOnCheckoutSubmitInput = {
          billingType: input.billingType,
          fullName: input.fullName.trim(),
          email: input.email.trim(),
          phone: input.phone,
          cpfCnpj: input.cpfCnpj,
          postalCode: input.postalCode,
          address: input.address.trim(),
          addressNumber: input.addressNumber.trim(),
          neighborhood: input.neighborhood.trim(),
          complement: input.complement ?? "",
          city: input.city.trim(),
          state: input.state.trim(),
          installments: input.billingType === "CREDIT_CARD" ? input.installments : 1,
          // O cartão segue só como token do Abacate Pay; os campos crus do contrato ficam vazios.
          cardHolderName: "",
          cardNumber: "",
          cardExpiryMonth: "",
          cardExpiryYear: "",
          cardCcv: "",
          cardToken: input.cardToken,
        }
        await submitPayment(payload)
      }}
      onRefreshStatus={handleRefreshStatus}
    />
  )
}
