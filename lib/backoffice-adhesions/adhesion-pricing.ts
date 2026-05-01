import type { BackofficeAdhesionBillingCycle, BackofficeProduct } from "@prisma/client"

export const BACKOFFICE_ADHESION_CYCLE_MONTHS: Record<
  BackofficeAdhesionBillingCycle,
  number
> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
}

export const BACKOFFICE_ADHESION_CYCLE_LABELS: Record<
  BackofficeAdhesionBillingCycle,
  string
> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
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
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
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
        : product.priceMonthly

  if (value == null) {
    throw new Error(`Produto ${product.slug} sem preço para o ciclo ${cycle}`)
  }

  const price = Number(value.toString())
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Produto ${product.slug} com preço inválido para o ciclo ${cycle}`)
  }

  return price
}

export function calculateBackofficeAdhesionPricing(
  input: BackofficeAdhesionPricingInput,
  prices: BackofficeAdhesionPrices
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

  return {
    cycleMonths,
    monthlyBaseAmount,
    monthlyExtraTeamsAmount,
    monthlyExtraUsersAmount,
    monthlyTotalAmount,
    totalAmount: roundCurrency(monthlyTotalAmount * cycleMonths),
    maxInstallments: cycleMonths,
  }
}
