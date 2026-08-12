import type { EmailCreditPlan } from "@prisma/client"

/**
 * Precificação canônica de créditos de e-mail (SPEC / Ticket 4).
 * Fonte de verdade para subscribe, status e apply pós-pagamento.
 */
export const PLAN_CREDITS: Record<EmailCreditPlan, number> = {
  starter: 1_000,
  plus: 5_000,
  pro: 10_000,
  upgrade: 25_000,
  business: 50_000,
}

export const PLAN_PRICES: Record<EmailCreditPlan, number> = {
  starter: 25.0,
  plus: 100.0,
  pro: 175.0,
  upgrade: 375.0,
  business: 650.0,
}

export const OVERAGE_RATE_PER_HUNDRED: Record<EmailCreditPlan, number> = {
  starter: 3.5,
  plus: 3.0,
  pro: 2.5,
  upgrade: 2.0,
  business: 1.5,
}

export function emailCreditsProductSlug(plan: EmailCreditPlan): string {
  return `email-credits-${plan}`
}

export function parseEmailCreditsPlanFromProductSlug(
  productSlug: string | null | undefined
): EmailCreditPlan | null {
  if (!productSlug) return null
  const match = /^email-credits-(starter|plus|pro|upgrade|business)$/.exec(
    productSlug.trim()
  )
  return (match?.[1] as EmailCreditPlan | undefined) ?? null
}
