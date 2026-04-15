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

export interface IEmailCreditService {
  getStatus(profileId: string): Promise<CreditStatus>
  hasEnoughCredits(profileId: string, amount: number): Promise<boolean>
  deductCredits(profileId: string, amount: number): Promise<void>
  getOverageRatePerHundred(plan: EmailCreditPlan): number
}
