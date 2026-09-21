import type { BackofficeAdhesionBillingCycle } from "@prisma/client"

/**
 * Pró-rata da Fase 6 G1 ([[50 — Backoffice de Cobrança — Backend]]) — sem
 * fórmula definida pelo owner (não é decisão de produto travada em nenhuma
 * nota da rodada), default de engenharia: crédito linear do plano atual
 * pelos dias restantes até `currentPeriodEnd`, líquido do custo do plano
 * alvo pelos mesmos dias. Nunca negativo (downgrade não gera crédito nesta
 * fase — fica para quando existir fluxo de reembolso).
 *
 * Duração de ciclo em dias — aproximação de calendário (30/90/120/180/365),
 * mesmo padrão usado em `BackofficeSubscriptionsPanelUseCase` (CYCLE_MONTHS).
 */
const CYCLE_DAYS: Record<BackofficeAdhesionBillingCycle, number> = {
  monthly: 30,
  quarterly: 90,
  quadrimester: 120,
  semiannual: 180,
  annual: 365,
}

const MS_PER_DAY = 86_400_000

export type SubscriptionChangeProrationInput = {
  currentChargedAmount: number
  currentCycle: BackofficeAdhesionBillingCycle | null
  currentPeriodEnd: Date | null
  targetListAmount: number
  targetCycle: BackofficeAdhesionBillingCycle
  now: Date
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateSubscriptionChangeProration(input: SubscriptionChangeProrationInput): number {
  const { currentChargedAmount, currentCycle, currentPeriodEnd, targetListAmount, targetCycle, now } = input

  if (!currentCycle || !currentPeriodEnd) {
    return roundCurrency(targetListAmount)
  }

  const remainingMs = currentPeriodEnd.getTime() - now.getTime()
  if (remainingMs <= 0) {
    return roundCurrency(targetListAmount)
  }

  const currentCycleDays = CYCLE_DAYS[currentCycle]
  const remainingDays = Math.min(Math.ceil(remainingMs / MS_PER_DAY), currentCycleDays)

  const unusedCredit = currentChargedAmount * (remainingDays / currentCycleDays)
  const targetCostForRemaining = (targetListAmount / CYCLE_DAYS[targetCycle]) * remainingDays

  return roundCurrency(Math.max(0, targetCostForRemaining - unusedCredit))
}
