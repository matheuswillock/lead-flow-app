import type { AsaasAccount, BillingCheckoutIntent } from "@prisma/client"

export type BillingCheckoutIntentStatus =
  | "awaiting_method"
  | "checkout_created"
  | "paid"
  | "subscription_creating"
  | "subscription_created"
  | "superseded"
  | "manual_reconciliation"

export type BillingCheckoutIntentRecord = BillingCheckoutIntent

export interface CreateBillingCheckoutIntentInput {
  profileId: string
  asaasCustomerId: string
  asaasAccount: AsaasAccount
  productSlug: string
  productId?: string | null
  cycle: string
  externalReference: string
  tokenHash: string
  tokenPreview: string
  expiresAt: Date
}

export interface UpdateBillingCheckoutIntentQuoteInput {
  billingType: "PIX" | "CREDIT_CARD"
  amount: number
  quoteSnapshot: Record<string, unknown>
  quoteHash: string
  checkoutId: string
  checkoutUrl: string
}

export interface IBillingCheckoutIntentRepository {
  create(input: CreateBillingCheckoutIntentInput): Promise<BillingCheckoutIntentRecord>
  findByTokenHash(tokenHash: string): Promise<BillingCheckoutIntentRecord | null>
  findByExternalReference(
    externalReference: string,
    account: AsaasAccount
  ): Promise<BillingCheckoutIntentRecord | null>
  findByCheckoutId(checkoutId: string, account: AsaasAccount): Promise<BillingCheckoutIntentRecord | null>
  findReusableCheckout(input: {
    profileId: string
    asaasAccount: AsaasAccount
    billingType: "PIX" | "CREDIT_CARD"
    amount: number
    now: Date
  }): Promise<BillingCheckoutIntentRecord | null>
  markCheckoutCreated(
    id: string,
    input: UpdateBillingCheckoutIntentQuoteInput
  ): Promise<BillingCheckoutIntentRecord>
  markSuperseded(id: string): Promise<BillingCheckoutIntentRecord>
  markPaid(id: string, paidAt: Date): Promise<BillingCheckoutIntentRecord>
  claimSubscriptionCreation(id: string): Promise<boolean>
  releaseSubscriptionCreation(id: string): Promise<boolean>
  markSubscriptionCreated(id: string, subscriptionId: string): Promise<BillingCheckoutIntentRecord>
  markManualReconciliation(id: string, reason: string): Promise<BillingCheckoutIntentRecord>
}
