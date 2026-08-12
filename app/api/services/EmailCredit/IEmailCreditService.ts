import type { EmailCreditPlan } from "@prisma/client"

export interface CreditStatus {
  hasSubscription: boolean
  plan: EmailCreditPlan | null
  monthlyCredits: number
  creditsUsed: number
  creditsAvailable: number
  overageCount: number
  overageCharged: number
  currentPeriodEnd: Date | null
}

export type ReserveCreditsResult =
  | { ok: true }
  | { ok: false; reason: "no_subscription" | "insufficient_balance"; available: number }

export type ApplyPaidPlanInput = {
  teamId: string
  plan: EmailCreditPlan
  paymentId: string
  checkoutId?: string | null
  timezone?: string | null
}

export type ApplyPaidPlanResult = {
  applied: boolean
  alreadyApplied: boolean
}

export interface IEmailCreditService {
  getStatus(teamId: string): Promise<CreditStatus>
  hasEnoughCredits(teamId: string, requiredAmount: number): Promise<boolean>
  reserveCredits(teamId: string, amount: number): Promise<ReserveCreditsResult>
  releaseCredits(teamId: string, amount: number): Promise<void>
  /** @deprecated Use reserveCredits — mantido para compatibilidade temporária em testes */
  deductCredits(teamId: string, amount: number): Promise<void>
  applyPaidPlan(input: ApplyPaidPlanInput): Promise<ApplyPaidPlanResult>
  getOverageRatePerHundred(plan: EmailCreditPlan): number
  formatInsufficientCreditsMessage(requiredAmount: number, available: number): string
}
