import type {
  PublicAdhesionBillingType,
  PublicAdhesionDetails,
} from "../context/PublicAdhesionTypes"

const roundMoney = (value: number) => Math.round(value * 100) / 100

export const MAX_CARD_INSTALLMENTS = 12

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatBRL(value: number): string {
  return BRL.format(value)
}

export type AdhesionPaymentSummary = {
  billingType: PublicAdhesionBillingType
  /** Total cobrado na forma de pagamento escolhida (plano + adicionais). */
  total: number
  /** Parte do plano, sem os adicionais. */
  planTotal: number
  /** Valor único dos adicionais no período. */
  extrasTotal: number
  /** Total dividido nos meses do período. */
  monthlyEquivalent: number
  /** Quanto o PIX economiza em relação ao cartão; zero quando não há diferença. */
  pixSavings: number
}

/** Parcelas que o cartão aceita: o cronograma fixo manda; senão vale o máximo do produto. */
export function maxInstallmentsFor(details: PublicAdhesionDetails): number {
  if (details.installmentSplitMode === "CUSTOM" && details.installmentSchedule.length > 0) {
    return details.installmentSchedule.length
  }
  const max = details.maxCardInstallments ?? details.maxInstallments ?? 1
  return Math.max(1, Math.min(MAX_CARD_INSTALLMENTS, Math.trunc(max)))
}

export function buildAdhesionPaymentSummary(
  details: PublicAdhesionDetails,
  billingType: PublicAdhesionBillingType,
): AdhesionPaymentSummary {
  const isCard = billingType === "CREDIT_CARD"
  const pixTotal = details.pixTotalAmount ?? details.totalAmount
  const cardTotal = details.creditCardTotalAmount ?? details.totalAmount
  const total = isCard ? cardTotal : pixTotal
  const extrasTotal = Math.min(Math.max(0, details.extrasTotalAmount ?? 0), total)
  const months = Math.max(1, details.cycleMonths ?? 1)
  return {
    billingType,
    total,
    planTotal: roundMoney(total - extrasTotal),
    extrasTotal,
    monthlyEquivalent: roundMoney(total / months),
    pixSavings: roundMoney(Math.max(0, cardTotal - pixTotal)),
  }
}

/** Valor de cada parcela do cartão (a última absorve a diferença de centavos). */
export function installmentAmounts(total: number, installments: number): number[] {
  const count = Math.max(1, Math.trunc(installments))
  const base = Math.floor((total / count) * 100) / 100
  const amounts = Array.from({ length: count }, () => base)
  amounts[count - 1] = roundMoney(total - base * (count - 1))
  return amounts
}

/** Valor em centavos para o formulário do cartão: precisa ser igual ao que o servidor cobra. */
export function toCents(value: number): number {
  return Math.round(value * 100)
}
