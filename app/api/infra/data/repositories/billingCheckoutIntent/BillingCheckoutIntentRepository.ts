import type { AsaasAccount, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBillingCheckoutIntentInput,
  IBillingCheckoutIntentRepository,
  UpdateBillingCheckoutIntentQuoteInput,
} from "./IBillingCheckoutIntentRepository"

export class BillingCheckoutIntentRepository implements IBillingCheckoutIntentRepository {
  async create(input: CreateBillingCheckoutIntentInput) {
    return prisma.billingCheckoutIntent.create({ data: input })
  }

  async findByTokenHash(tokenHash: string) {
    return prisma.billingCheckoutIntent.findUnique({ where: { tokenHash } })
  }

  async findByExternalReference(externalReference: string, account: AsaasAccount) {
    return prisma.billingCheckoutIntent.findFirst({
      where: { externalReference, asaasAccount: account },
    })
  }

  async findByCheckoutId(checkoutId: string, account: AsaasAccount) {
    return prisma.billingCheckoutIntent.findFirst({
      where: { checkoutId, asaasAccount: account },
    })
  }

  async findReusableCheckout(input: {
    profileId: string
    asaasAccount: AsaasAccount
    billingType: "PIX" | "CREDIT_CARD"
    amount: number
    now: Date
  }) {
    return prisma.billingCheckoutIntent.findFirst({
      where: {
        profileId: input.profileId,
        asaasAccount: input.asaasAccount,
        billingType: input.billingType,
        amount: input.amount,
        status: "checkout_created",
        expiresAt: { gt: input.now },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async markCheckoutCreated(id: string, input: UpdateBillingCheckoutIntentQuoteInput) {
    return prisma.billingCheckoutIntent.update({
      where: { id },
      data: {
        billingType: input.billingType,
        amount: input.amount,
        quoteSnapshot: input.quoteSnapshot as Prisma.InputJsonValue,
        quoteHash: input.quoteHash,
        checkoutId: input.checkoutId,
        checkoutUrl: input.checkoutUrl,
        status: "checkout_created",
      },
    })
  }

  async markSuperseded(id: string) {
    return prisma.billingCheckoutIntent.update({
      where: { id },
      data: { status: "superseded" },
    })
  }

  async markPaid(id: string, paidAt: Date) {
    return prisma.billingCheckoutIntent.updateMany({
      where: { id, status: { in: ["checkout_created", "paid"] } },
      data: { status: "paid", paidAt },
    }).then(async () => prisma.billingCheckoutIntent.findUniqueOrThrow({ where: { id } }))
  }

  async claimSubscriptionCreation(id: string): Promise<boolean> {
    const result = await prisma.billingCheckoutIntent.updateMany({
      where: { id, status: { in: ["checkout_created", "paid"] } },
      data: { status: "subscription_creating" },
    })
    return result.count === 1
  }

  async markSubscriptionCreated(id: string, subscriptionId: string) {
    return prisma.billingCheckoutIntent.update({
      where: { id },
      data: { status: "subscription_created", subscriptionId },
    })
  }

  async markManualReconciliation(id: string, reason: string) {
    const current = await prisma.billingCheckoutIntent.findUnique({
      where: { id },
      select: { quoteSnapshot: true },
    })
    return prisma.billingCheckoutIntent.update({
      where: { id },
      data: {
        status: "manual_reconciliation",
        quoteSnapshot: {
          ...(current?.quoteSnapshot && typeof current.quoteSnapshot === "object" && !Array.isArray(current.quoteSnapshot)
            ? current.quoteSnapshot as Record<string, unknown>
            : {}),
          manualReconciliationReason: reason,
        } as Prisma.InputJsonValue,
      },
    })
  }
}

export const billingCheckoutIntentRepository = new BillingCheckoutIntentRepository()
