"use client"

import { useEffect, useMemo } from "react"

import { PublicCheckoutFlow } from "@/components/public-checkout/PublicCheckoutFlow"
import type {
  PublicCheckoutDetails,
  PublicCheckoutPaymentView,
  PublicCheckoutPayerPrefill,
} from "@/components/public-checkout/publicCheckoutTypes"
import { useAddOnCheckout } from "../context/AddOnCheckoutHook"
import type { AddOnCheckoutSubmitInput } from "../context/AddOnCheckoutTypes"

const ATTEMPT_STORAGE_PREFIX = "addon-checkout-attempt-start:"

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
}

export function AddOnCheckoutContainer({ pendingActionId }: AddOnCheckoutContainerProps) {
  const { state, fetchCheckoutData, submitPayment, refreshPaymentStatus, clearPolling } = useAddOnCheckout()

  useEffect(() => {
    fetchCheckoutData(pendingActionId)
    return () => clearPolling()
  }, [pendingActionId, fetchCheckoutData, clearPolling])

  const mappedDetails = useMemo<PublicCheckoutDetails | null>(() => {
    const data = state.data
    if (!data) return null

    const preset = data.presetBillingType
    const startDate = new Date()
    const dueDate = addMonths(startDate, Math.max(1, data.pricing.remainingMonths ?? 1))
    const totalCharge = data.pricing.totalCharge ?? 0

    const title = data.addonType === "team" ? "Add-on Time" : "Add-on Usuario"
    const subtitle =
      data.pricing.remainingMonths > 1
        ? `Cobranca proporcional por ${data.pricing.remainingMonths} meses`
        : "Cobranca proporcional"

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

    const compositionRows = [
      ...invoiceItems.map((item) => ({
        label: `${item.title} (${item.quantity}x)`,
        value: formatCurrency(item.totalAmountMonthly),
      })),
      {
        label: "Meses restantes",
        value: `${data.pricing.remainingMonths} mes${data.pricing.remainingMonths === 1 ? "" : "es"}`,
      },
      { label: "Total", value: formatCurrency(totalCharge), emphasize: true },
    ]

    return {
      presetBillingType: preset,
      title,
      subtitle,
      includedTitle: data.addonLabel,
      includedSubtitle: data.addonDetail,
      compositionTitle: "COMPOSICAO DO PLANO",
      compositionRows,
      invoiceItems,
      invoiceSummary: {
        monthlyTotal: data.pricing.monthlyPrice ?? 0,
        totalDueNow: totalCharge,
        billingHint: preset === "CREDIT_CARD" ? "Cartao de credito" : "PIX",
      },
      monthlyTotalLabel: "Total Mensal",
      monthlyTotalValue: `${formatCurrency(data.pricing.monthlyPrice)} / mes`,
      totalTitle: "TOTAL",
      totalSubtitle: "Pagamento unico",
      totalValue: formatCurrency(totalCharge),
      totalHint: preset === "CREDIT_CARD" ? `em ate ${Math.max(1, data.pricing.maxInstallments)}x no cartao` : "via PIX",
      startLabel: "Inicio",
      startValue: formatDate(startDate),
      dueLabel: "Vencimento",
      dueValue: formatDate(dueDate),
      issuedLabel: "Emitido por Corretor Studio",
      issuedValue: formatDate(new Date()),
    }
  }, [state.data])

  const mappedPayment = useMemo<PublicCheckoutPaymentView | null>(() => {
    if (!mappedDetails) return null
    const paymentData = state.paymentData as any
    const paymentStatus = state.paymentStatus

    if (!paymentData && !paymentStatus) return null

    const isApplied = paymentStatus?.pendingActionStatus === "applied" || state.step === "success"
    const status = isApplied
      ? "paid"
      : paymentStatus?.pendingActionStatus === "canceled"
        ? "canceled"
        : paymentStatus?.pendingActionStatus === "failed"
          ? "error"
          : "pending"

    const amount = typeof paymentData?.amount === "number" ? paymentData.amount : typeof paymentStatus?.amount === "number" ? paymentStatus.amount : 0

    return {
      status,
      billingType: mappedDetails.presetBillingType,
      amountLabel: "Valor",
      amountValue: formatCurrency(amount),
      invoiceUrl: paymentData?.invoiceUrl ?? null,
      pix: paymentData?.pix ?? null,
    }
  }, [mappedDetails, state.paymentData, state.paymentStatus, state.step])

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

  const maxInstallments =
    mappedDetails?.presetBillingType === "PIX" ? 1 : state.data?.pricing.maxInstallments ?? 1

  const error = state.step === "error" ? state.error ?? "Erro ao carregar checkout" : null
  const isLoading = state.step === "loading"
  const isSubmitting = state.isProcessing

  return (
    <PublicCheckoutFlow
      attemptStorageKey={getAttemptStorageKey(pendingActionId)}
      details={mappedDetails}
      payment={mappedPayment}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      error={error}
      maxInstallments={maxInstallments}
      prefill={prefill}
      onSubmit={async (input) => {
        if (!mappedDetails) return
        const payload: AddOnCheckoutSubmitInput = {
          billingType: mappedDetails.presetBillingType,
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
          installments: mappedDetails.presetBillingType === "CREDIT_CARD" ? input.installments : 1,
          cardHolderName: input.creditCard.holderName.trim(),
          cardNumber: input.creditCard.number,
          cardExpiryMonth: input.creditCard.expiryMonth,
          cardExpiryYear: input.creditCard.expiryYear,
          cardCcv: input.creditCard.ccv,
        }
        await submitPayment(payload)
      }}
      onRefreshStatus={async (options) => {
        if (!options?.sync) return refreshPaymentStatus()
        return refreshPaymentStatus()
      }}
    />
  )
}
