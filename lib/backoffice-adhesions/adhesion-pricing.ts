import type { BackofficeAdhesionBillingCycle, BackofficePaymentMethod, BackofficeProduct, BackofficeProductPaymentRule } from "@prisma/client"

export const BACKOFFICE_ADHESION_CYCLE_MONTHS: Record<
  BackofficeAdhesionBillingCycle,
  number
> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

export const BACKOFFICE_ADHESION_CYCLE_LABELS: Record<
  BackofficeAdhesionBillingCycle,
  string
> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
}

export interface BackofficeAdhesionPricingInput {
  cycle: BackofficeAdhesionBillingCycle
  extraTeams: number
  extraUsers: number
}

export interface BackofficeAdhesionPrices {
  baseMonthlyPrice: number
  extraTeamPrice: number
  extraUserPrice: number
}

export interface BackofficeAdhesionPricing {
  cycleMonths: number
  monthlyBaseAmount: number
  monthlyExtraTeamsAmount: number
  monthlyExtraUsersAmount: number
  monthlyTotalAmount: number
  totalAmount: number
  maxInstallments: number
  pixMonthlyTotalAmount: number
  pixTotalAmount: number
  creditCardMonthlyTotalAmount: number
  creditCardTotalAmount: number
  maxCardInstallments: number
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
}

/** Em CUSTOM, `price` é o total do ciclo; em EQUAL, é o valor mensal. */
export function resolveCardMonthlyPriceFromRule(
  cardRule: Pick<BackofficeProductPaymentRule, "price" | "installmentSplitMode">,
  cycle: BackofficeAdhesionBillingCycle
): number {
  const price = roundCurrency(Number(cardRule.price.toString()))
  if (cardRule.installmentSplitMode === "CUSTOM") {
    const months = BACKOFFICE_ADHESION_CYCLE_MONTHS[cycle] ?? 1
    return roundCurrency(price / months)
  }
  return price
}

/**
 * Escala um schedule CUSTOM (ou lista de parcelas) para somar exatamente `targetTotal`.
 * Usado para incluir add-ons no ledger sem distorcer a proporção das parcelas.
 */
export function scaleInstallmentScheduleToTotal(
  schedule: number[],
  targetTotal: number
): number[] {
  if (schedule.length === 0) return []
  const safeTarget = roundCurrency(targetTotal)
  if (schedule.length === 1) return [safeTarget]

  const baseSum = schedule.reduce((sum, value) => sum + Number(value || 0), 0)
  if (!(baseSum > 0)) {
    const base = roundCurrency(safeTarget / schedule.length)
    const parts = Array.from({ length: schedule.length }, () => base)
    const drift = roundCurrency(safeTarget - parts.reduce((sum, value) => sum + value, 0))
    parts[parts.length - 1] = roundCurrency(parts[parts.length - 1] + drift)
    return parts
  }

  const scaled = schedule.map((value) =>
    roundCurrency((Number(value) / baseSum) * safeTarget)
  )
  const drift = roundCurrency(safeTarget - scaled.reduce((sum, value) => sum + value, 0))
  scaled[scaled.length - 1] = roundCurrency(scaled[scaled.length - 1] + drift)
  return scaled
}

export function resolveProductPriceForCycle(
  product: BackofficeProduct,
  cycle: BackofficeAdhesionBillingCycle
): number {
  const value =
    cycle === "quarterly"
      ? product.priceQuarterly
      : cycle === "semiannual"
        ? product.priceSemiannual
        : cycle === "annual"
          ? product.priceAnnual
        : product.priceMonthly

  if (value == null) {
    throw new Error(`Produto ${product.name} sem preço para o ciclo ${cycle}`)
  }

  const price = Number(value.toString())
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Produto ${product.name} com preço inválido para o ciclo ${cycle}`)
  }

  return price
}

export function resolvePaymentRule(
  rules: BackofficeProductPaymentRule[],
  cycle: BackofficeAdhesionBillingCycle,
  paymentMethod: BackofficePaymentMethod
): BackofficeProductPaymentRule {
  const rule = rules.find(
    (r) => r.billingCycle === cycle && r.paymentMethod === paymentMethod
  )
  if (!rule) {
    throw new Error(`Regra de pagamento não encontrada para ciclo ${cycle} e método ${paymentMethod}`)
  }
  return rule
}

export function calculateBackofficeAdhesionPricing(
  input: BackofficeAdhesionPricingInput,
  prices: BackofficeAdhesionPrices,
  paymentRules?: BackofficeProductPaymentRule[]
): BackofficeAdhesionPricing {
  const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[input.cycle] ?? 1
  const extraTeams = Math.max(0, Math.trunc(input.extraTeams || 0))
  const extraUsers = Math.max(0, Math.trunc(input.extraUsers || 0))
  const monthlyBaseAmount = roundCurrency(prices.baseMonthlyPrice)
  const monthlyExtraTeamsAmount = roundCurrency(
    extraTeams * prices.extraTeamPrice
  )
  const monthlyExtraUsersAmount = roundCurrency(
    extraUsers * prices.extraUserPrice
  )
  const monthlyTotalAmount = roundCurrency(
    monthlyBaseAmount + monthlyExtraTeamsAmount + monthlyExtraUsersAmount
  )

  let pixMonthlyTotalAmount = monthlyTotalAmount
  let pixTotalAmount = roundCurrency(monthlyTotalAmount * cycleMonths)
  let creditCardMonthlyTotalAmount = monthlyTotalAmount
  let creditCardTotalAmount = roundCurrency(monthlyTotalAmount * cycleMonths)
  let maxCardInstallments = cycleMonths

  if (paymentRules && paymentRules.length > 0) {
    try {
      const pixRule = resolvePaymentRule(paymentRules, input.cycle, "PIX")
      const pixBaseMonthly = roundCurrency(Number(pixRule.price.toString()))
      const pixMonthlyExtras = roundCurrency(monthlyExtraTeamsAmount + monthlyExtraUsersAmount)
      pixMonthlyTotalAmount = roundCurrency(pixBaseMonthly + pixMonthlyExtras)
      pixTotalAmount = roundCurrency(pixMonthlyTotalAmount * cycleMonths)
    } catch {
      // fallback to flat price
    }

    try {
      const cardRule = resolvePaymentRule(paymentRules, input.cycle, "CREDIT_CARD")
      const cardMonthlyExtras = roundCurrency(monthlyExtraTeamsAmount + monthlyExtraUsersAmount)
      if (cardRule.installmentSplitMode === "CUSTOM") {
        const cardBaseTotal = roundCurrency(Number(cardRule.price.toString()))
        creditCardTotalAmount = roundCurrency(cardBaseTotal + cardMonthlyExtras * cycleMonths)
        creditCardMonthlyTotalAmount = roundCurrency(creditCardTotalAmount / cycleMonths)
      } else {
        creditCardMonthlyTotalAmount = roundCurrency(
          resolveCardMonthlyPriceFromRule(cardRule, input.cycle) + cardMonthlyExtras
        )
        creditCardTotalAmount = roundCurrency(creditCardMonthlyTotalAmount * cycleMonths)
      }
      maxCardInstallments = cardRule.maxInstallments
    } catch {
      // fallback to flat price
    }
  }

  return {
    cycleMonths,
    monthlyBaseAmount,
    monthlyExtraTeamsAmount,
    monthlyExtraUsersAmount,
    monthlyTotalAmount: creditCardMonthlyTotalAmount,
    totalAmount: creditCardTotalAmount,
    maxInstallments: maxCardInstallments,
    pixMonthlyTotalAmount,
    pixTotalAmount,
    creditCardMonthlyTotalAmount,
    creditCardTotalAmount,
    maxCardInstallments,
  }
}
