import { parseEmailCreditsPlanFromProductSlug } from "@/lib/email/email-credit-plans"
import type { AddOnCheckoutData } from "../context/AddOnCheckoutTypes"

export type PlatformCheckoutApiResult = {
  checkoutId: string
  purchaseId: string
  productSlug: string
  purchaseType: string
  status: string
  billingType: string | null
  amount: number
  quantity: number | null
  description: string | null
  teamId: string | null
  metadata?: unknown
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
  upgrade: "Upgrade",
  business: "Business",
}

function emptyBillingDefaults(): AddOnCheckoutData["defaultBillingData"] {
  return {
    fullName: "",
    email: "",
    phone: "",
    cpfCnpj: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    complement: "",
    city: "",
    state: "",
  }
}

export function mapPlatformPurchaseToCheckoutData(
  purchase: PlatformCheckoutApiResult
): AddOnCheckoutData {
  const plan = parseEmailCreditsPlanFromProductSlug(purchase.productSlug)
  const planLabel = plan ? PLAN_LABELS[plan] ?? purchase.productSlug : purchase.productSlug
  const credits = purchase.quantity ?? 0
  const billingType =
    purchase.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX"
  const isPaid = purchase.status === "paid"
  const metadata =
    purchase.metadata && typeof purchase.metadata === "object"
      ? (purchase.metadata as Record<string, unknown>)
      : {}
  const teamLabel =
    typeof metadata.teamName === "string" && metadata.teamName.trim()
      ? metadata.teamName.trim()
      : purchase.teamId
        ? "Time selecionado"
        : "—"

  return {
    pendingActionId: purchase.purchaseId || purchase.checkoutId,
    paymentId: null,
    presetBillingType: billingType,
    addonType: "user",
    addonLabel: planLabel,
    addonDetail:
      credits > 0
        ? `${credits.toLocaleString("pt-BR")} créditos/mês · ${teamLabel}`
        : teamLabel,
    pricing: {
      monthlyPrice: purchase.amount,
      remainingMonths: 1,
      totalCharge: purchase.amount,
      maxInstallments: 1,
    },
    status: isPaid ? "applied" : "pending",
    masterName: "",
    alreadyPaid: isPaid,
    defaultBillingData: emptyBillingDefaults(),
    checkoutSource: "platform_purchase",
    purchaseType: purchase.purchaseType,
    productSlug: purchase.productSlug,
    activationHint: "A ativação acontece após confirmação do pagamento.",
  }
}
