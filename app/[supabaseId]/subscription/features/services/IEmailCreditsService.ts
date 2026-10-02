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

/**
 * DA3 (SPEC 21): resultado discriminado — `getStatus()` deixa de devolver
 * `null` tanto para "sem plano" quanto para "falha de fetch". Um 500
 * transitório não pode mais virar "Nenhum plano ativo" com o botão
 * "Comprar" habilitado (risco de segundo checkout do mesmo add-on).
 */
export type EmailCreditsStatusResult =
  | { ok: true; status: EmailCreditsStatus }
  | { ok: false }

export interface IEmailCreditsService {
  getStatus(): Promise<EmailCreditsStatusResult>
  subscribe(
    plan: EmailCreditPlanId,
    billingType?: EmailCreditsBillingType
  ): Promise<EmailCreditsSubscribeResult>
  cancel(): Promise<void>
}
