import type { BackofficeAdhesionBillingCycle } from "@prisma/client"

export const BACKOFFICE_ADHESION_PRICES = {
  base: 59.9,
  extraTeam: 29.9,
  extraUser: 19.9,
} as const

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

export function calculateBackofficeAdhesionPricing(
  input: BackofficeAdhesionPricingInput
): BackofficeAdhesionPricing {
  const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[input.cycle] ?? 1
  const extraTeams = Math.max(0, Math.trunc(input.extraTeams || 0))
  const extraUsers = Math.max(0, Math.trunc(input.extraUsers || 0))
  const monthlyBaseAmount = BACKOFFICE_ADHESION_PRICES.base
  const monthlyExtraTeamsAmount = roundCurrency(
    extraTeams * BACKOFFICE_ADHESION_PRICES.extraTeam
  )
  const monthlyExtraUsersAmount = roundCurrency(
    extraUsers * BACKOFFICE_ADHESION_PRICES.extraUser
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
