"use client"

import { useEffect, useMemo } from "react"

import { PublicCheckoutFlow } from "@/components/public-checkout/PublicCheckoutFlow"
import type {
  PublicCheckoutDetails,
  PublicCheckoutPaymentView,
  PublicCheckoutPayerPrefill,
} from "@/components/public-checkout/publicCheckoutTypes"
import { usePublicAdhesion } from "../context/PublicAdhesionHook"
import type { PublicAdhesionCheckoutInput } from "../context/PublicAdhesionTypes"

const ATTEMPT_STORAGE_PREFIX = "public-adhesion-attempt-start:"

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

function getAttemptStorageKey(token: string): string {
  return `${ATTEMPT_STORAGE_PREFIX}${token}`
}

export function PublicAdhesionContainer() {
  const { token, details, payment, isLoading, isSubmitting, error, submitCheckout, refreshPaymentStatus } =
    usePublicAdhesion()

  useEffect(() => {
    if (!error) return
  }, [error])

  const mappedDetails = useMemo<PublicCheckoutDetails | null>(() => {
    if (!details) return null

    const preset = details.billingType ?? "PIX"
    const cycleMonths = details.cycleMonths ?? 1
    const paidAt = details.paidAt ? new Date(details.paidAt) : null
    const createdAt = details.createdAt ? new Date(details.createdAt) : null
    const startDate = paidAt ?? createdAt
    const dueDate = startDate ? addMonths(startDate, cycleMonths) : null
    const extrasMonthly =
      (details.monthlyExtraTeamsAmount ?? 0) + (details.monthlyExtraUsersAmount ?? 0)
    const selectedMonthlyTotal =
      preset === "CREDIT_CARD"
        ? details.creditCardMonthlyTotalAmount ?? details.monthlyTotalAmount ?? 0
        : details.pixMonthlyTotalAmount ?? details.monthlyTotalAmount ?? 0
    const selectedBaseMonthly = Math.max(0, selectedMonthlyTotal - extrasMonthly)

    const invoiceItems = [
      {
        icon: "master" as const,
        title: "Acesso Master",
        description: "Plano principal do Corretor Studio",
        quantity: 1,
        unitAmountMonthly: selectedBaseMonthly,
        totalAmountMonthly: selectedBaseMonthly,
      },
      ...(details.extraUsers > 0
        ? [
            {
              icon: "users" as const,
              title: "Usuário adicional",
              description: "Cota pré-paga para adicionar usuários na conta",
              quantity: details.extraUsers,
              unitAmountMonthly:
                details.extraUsers > 0
                  ? (details.monthlyExtraUsersAmount ?? 0) / details.extraUsers
                  : 0,
              totalAmountMonthly: details.monthlyExtraUsersAmount ?? 0,
            },
          ]
        : []),
      ...(details.extraTeams > 0
        ? [
            {
              icon: "team" as const,
              title: "Time adicional",
              description: "Cota pré-paga para criar times além do time principal",
              quantity: details.extraTeams,
              unitAmountMonthly:
                details.extraTeams > 0
                  ? (details.monthlyExtraTeamsAmount ?? 0) / details.extraTeams
                  : 0,
              totalAmountMonthly: details.monthlyExtraTeamsAmount ?? 0,
            },
          ]
        : []),
    ]

    const totalDueNow =
      details.chargeAmount > 0
        ? details.chargeAmount
        : preset === "CREDIT_CARD"
          ? details.creditCardTotalAmount ?? 0
          : details.pixTotalAmount ?? 0
    const monthlyTotal =
      selectedMonthlyTotal

    const compositionRows = [
      ...invoiceItems.map((item) => ({
        label: `${item.title} (${item.quantity}x)`,
        value: formatCurrency(item.totalAmountMonthly),
      })),
      { label: "Total Mensal", value: `${formatCurrency(monthlyTotal)} / mês`, emphasize: true },
    ]

    return {
      presetBillingType: preset,
      title: details.cycleLabel,
      subtitle: `Acesso completo a plataforma por ${cycleMonths} mes${cycleMonths === 1 ? "" : "es"}`,
      includedTitle: `${1 + details.extraUsers} usuários inclusos`,
      includedSubtitle: "Acesso Master + usuário adicional",
      includedBadges: details.extraTeams > 0 ? ["Time adicional"] : undefined,
      compositionTitle: "COMPOSIÇÃO DO PLANO",
      compositionRows,
      invoiceItems,
      invoiceSummary: {
        monthlyTotal,
        cycleMonths,
        totalDueNow,
        billingHint: preset === "CREDIT_CARD" ? "Cartão de crédito" : "PIX",
      },
      monthlyTotalLabel: "Total Mensal",
      monthlyTotalValue: `${formatCurrency(monthlyTotal)} / mês`,
      totalTitle: `TOTAL ${details.cycleLabel.toUpperCase()}`,
      totalSubtitle: `${cycleMonths} meses de acesso`,
      totalValue: formatCurrency(totalDueNow),
      totalHint:
        preset === "CREDIT_CARD"
          ? details.installmentSplitMode === "CUSTOM" && details.installmentSchedule.length > 0
            ? `cronograma: ${details.installmentSchedule.map((value) => formatCurrency(value)).join(" + ")}`
            : `em até ${Math.max(1, details.maxCardInstallments ?? details.maxInstallments ?? 1)}x no cartão`
          : "via PIX",
      installmentSplitMode: details.installmentSplitMode,
      installmentSchedule: details.installmentSchedule,
      startLabel: "Início",
      startValue: startDate ? formatDate(startDate) : "—",
      dueLabel: "Vencimento",
      dueValue: dueDate ? formatDate(dueDate) : "—",
      issuedLabel: "Emitido por Corretor Studio",
      issuedValue: formatDate(new Date()),
    }
  }, [details])

  const mappedPayment = useMemo<PublicCheckoutPaymentView | null>(() => {
    if (!mappedDetails || !payment) return null

    const normalizedStatus =
      payment.status === "canceled"
        ? "canceled"
        : payment.status === "expired"
          ? "expired"
          : payment.status === "overdue"
            ? "overdue"
            : payment.status === "paid"
              ? "paid"
              : "pending"

    return {
      status: normalizedStatus,
      billingType: mappedDetails.presetBillingType,
      amountLabel: "Valor",
      amountValue: formatCurrency(payment.amount ?? 0),
      invoiceUrl: payment.invoiceUrl ?? null,
      pix: payment.pix ?? null,
    }
  }, [mappedDetails, payment])

  const prefill = useMemo<PublicCheckoutPayerPrefill>(() => {
    return {
      fullName: details?.fullName ?? "",
      email: details?.email ?? "",
      phone: details?.phone ?? "",
      cpfCnpj: details?.cpfCnpj ?? "",
      postalCode: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      complement: "",
      city: "",
      state: "",
    }
  }, [details])

  const maxInstallments =
    mappedDetails?.presetBillingType === "PIX"
      ? 1
      : mappedDetails?.installmentSplitMode === "CUSTOM"
        ? Math.max(1, mappedDetails.installmentSchedule?.length ?? 1)
        : details?.maxCardInstallments ?? details?.maxInstallments ?? 1

  return (
    <PublicCheckoutFlow
      attemptStorageKey={getAttemptStorageKey(token)}
      details={mappedDetails}
      payment={mappedPayment}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      error={error}
      maxInstallments={maxInstallments}
      prefill={prefill}
      onSubmit={async (input) => {
        if (!mappedDetails) return
        const payload: PublicAdhesionCheckoutInput = {
          fullName: input.fullName.trim(),
          email: input.email.trim(),
          phone: input.phone,
          cpfCnpj: input.cpfCnpj,
          postalCode: input.postalCode,
          address: input.address.trim(),
          addressNumber: input.addressNumber.trim(),
          neighborhood: input.neighborhood.trim(),
          complement: input.complement ?? null,
          city: input.city.trim(),
          state: input.state.trim(),
          billingType: mappedDetails.presetBillingType,
          installments: mappedDetails.presetBillingType === "CREDIT_CARD" ? input.installments : 1,
          creditCard: {
            holderName: input.creditCard.holderName.trim(),
            number: input.creditCard.number,
            expiryMonth: input.creditCard.expiryMonth,
            expiryYear: input.creditCard.expiryYear,
            ccv: input.creditCard.ccv,
          },
        }
        await submitCheckout(payload)
      }}
      onRefreshStatus={async (options) => refreshPaymentStatus(options)}
    />
  )
}
