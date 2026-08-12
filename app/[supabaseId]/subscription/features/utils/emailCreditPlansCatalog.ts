import type { EmailCreditPlan } from "@prisma/client"
import { PLAN_CREDITS, PLAN_PRICES } from "@/lib/email/email-credit-plans"

export type EmailCreditPlanCatalogItem = {
  id: EmailCreditPlan
  label: string
  credits: number
  price: number
}

const PLAN_LABELS: Record<EmailCreditPlan, string> = {
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
  upgrade: "Upgrade",
  business: "Business",
}

const PLAN_ORDER: EmailCreditPlan[] = [
  "starter",
  "plus",
  "pro",
  "upgrade",
  "business",
]

export const EMAIL_CREDIT_PLAN_CATALOG: EmailCreditPlanCatalogItem[] = PLAN_ORDER.map(
  (id) => ({
    id,
    label: PLAN_LABELS[id],
    credits: PLAN_CREDITS[id],
    price: PLAN_PRICES[id],
  })
)

export function getEmailCreditPlanLabel(plan: EmailCreditPlan | string | null | undefined): string {
  if (!plan) return "—"
  if (plan in PLAN_LABELS) return PLAN_LABELS[plan as EmailCreditPlan]
  return String(plan)
}
