import type { EmailCreditPlan } from "@prisma/client"
import type { AsaasAccountId } from "@/lib/asaas"

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
  // Achado Codex (PR #1137, P1): idempotência por paymentId sozinho colide
  // entre contas Asaas (C33). Default primary preserva o comportamento para
  // chamadores que ainda não propagam a conta do evento.
  account?: AsaasAccountId
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
