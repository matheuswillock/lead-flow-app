import type { EmailCreditPlan } from "@prisma/client"

export type EmailCreditPlanId = EmailCreditPlan

export type EmailCreditsStatus = {
  hasSubscription: boolean
  isBetaExempt?: boolean
  plan: EmailCreditPlanId | null
  monthlyCredits: number
  creditsUsed: number
  creditsAvailable: number
  currentPeriodEnd: string | null
  status: string | null
  pricePerMonth?: number | null
}

export type EmailCreditsSubscribeResult = {
  checkoutId: string
  checkoutUrl: string
  externalReference: string
  status: string
  plan: EmailCreditPlanId
  monthlyCredits: number
  pricePerMonth: number
  teamId: string
  subscriptionActivated: boolean
}

export type EmailCreditsBillingType = "PIX" | "CREDIT_CARD"

export interface IEmailCreditsService {
  getStatus(): Promise<EmailCreditsStatus | null>
  subscribe(
    plan: EmailCreditPlanId,
    billingType?: EmailCreditsBillingType
  ): Promise<EmailCreditsSubscribeResult>
  cancel(): Promise<void>
}
