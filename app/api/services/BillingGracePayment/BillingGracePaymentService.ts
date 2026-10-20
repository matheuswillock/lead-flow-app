import { PaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import { createAbacatePayProvider, resolvePaymentProviderEnvironment } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import { buildBillingSummary } from "@/app/api/shared/billing/billingSummary"
import { PaymentProviderRegistry } from "@/lib/payment-provider/registry"
import { PaymentProviderRouter } from "@/lib/payment-provider/router"
import type { Prisma } from "@prisma/client"
import type { BillingGracePaymentQuote, IBillingGracePaymentService } from "./IBillingGracePaymentService"

const QUOTE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 60 * 1000
const ROUTE_VERSION = "BILLING-GRACE-PHASE-5"

const configRepository = new PaymentProviderConfigRepository()
const paymentProviderRouter = new PaymentProviderRouter(
  configRepository,
  new PaymentProviderRegistry([
    {
      metadata: {
        key: "ABACATE_PAY",
        environment: "DEV",
        capabilities: ["ONE_TIME_PAYMENT", "HOSTED_CHECKOUT", "PIX", "STATUS_QUERY", "WEBHOOK"],
      },
    },
  ]),
)

export class BillingGracePaymentService implements IBillingGracePaymentService {
  async getQuote(supabaseId: string): Promise<BillingGracePaymentQuote> {
    const account = await billingGracePaymentRepository.findAccountContext(supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")

    const summary = buildAccountSummary(account)
    const amountCents = Math.round(summary.totalPrice * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
      throw new Error("Não foi possível calcular o valor da regularização")
    }

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS)
    return {
      cycle: "one-time",
      amountCents,
      expiresAt: expiresAt.toISOString(),
      method: "PIX",
    }
  }

  async createPixPayment(input: { supabaseId: string; idempotencyKey: string }) {
    const existing = await billingGracePaymentRepository.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return existing

    const account = await billingGracePaymentRepository.findAccountContext(input.supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")

    const summary = buildAccountSummary(account)
    const amountCents = Math.round(summary.totalPrice * 100)
    const payment = await billingGracePaymentRepository.create({
      accountId: account.accountId,
      teamId: account.teamId,
      subscriptionId: account.subscriptionId,
      cycle: "one-time",
      amountCents,
      effectivePriceCents: amountCents,
      provider: "ABACATE_PAY",
      providerEnvironment: resolvePaymentProviderEnvironment(),
      idempotencyKey: input.idempotencyKey,
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })

    const environment = resolvePaymentProviderEnvironment()
    const selected = await paymentProviderRouter.select({
      environment,
      requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"],
    })
    const provider = createAbacatePayProvider(environment)
    const session = await paymentProviderSessionRepository.createSession({
      tenantId: account.teamId ?? account.accountId,
      ownerType: "BILLING_GRACE_PAYMENT",
      ownerId: payment.id,
      idempotencyKey: input.idempotencyKey,
      provider: selected.provider,
      environment: selected.environment,
      externalAccountContext: selected.externalAccountContext,
      route: "NEW_ROUTER",
      routeVersion: ROUTE_VERSION,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    const attempt = await paymentProviderSessionRepository.createAttempt({
      sessionId: session.id,
      tenantId: account.teamId ?? account.accountId,
      ownerType: "BILLING_GRACE_PAYMENT",
      ownerId: payment.id,
      now: new Date(),
      attemptNumber: 1,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: JSON.stringify({ amountCents, method: "PIX", accountId: account.accountId }),
      provider: selected.provider,
      environment: selected.environment,
      externalAccountContext: selected.externalAccountContext,
    })
    const leased = await paymentProviderSessionRepository.acquireAttemptLease({
      attemptId: attempt.id,
      tenantId: account.teamId ?? account.accountId,
      ownerType: "BILLING_GRACE_PAYMENT",
      ownerId: payment.id,
      purpose: "PAYMENT",
      now: new Date(),
      ttlMs: 60_000,
    })
    const outcome = await provider.createHostedCheckout({
      amountInCents: amountCents,
      externalReference: `${payment.id}:${attempt.id}`,
      metadata: { paymentId: payment.id, attemptId: attempt.id },
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.corretorstudio.com"}/${account.accountId}/billing-grace-payment`,
      completionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.corretorstudio.com"}/${account.accountId}/billing-grace-payment?payment=completed`,
    })
    const updated = await paymentProviderSessionRepository.updateAttemptWithLease({
      attemptId: leased.id,
      tenantId: account.teamId ?? account.accountId,
      ownerType: "BILLING_GRACE_PAYMENT",
      ownerId: payment.id,
      lease: leased.lease,
      now: new Date(),
      status: outcome.status,
      expectedStatus: "CREATED",
      operation: "PAYMENT",
      externalId: "externalId" in outcome ? outcome.externalId : null,
    })
    return billingGracePaymentRepository.attachProviderAttempt({
      id: payment.id,
      providerSessionId: session.id,
      providerAttemptId: updated.id,
      providerExternalId: updated.externalId,
      paymentInstructions: { checkoutUrl: outcome.url } as Prisma.InputJsonValue,
    })
  }

  async getPayment(input: { id: string; supabaseId: string }) {
    const account = await billingGracePaymentRepository.findAccountContext(input.supabaseId)
    if (!account) throw new Error("Somente o master pode consultar esta regularização")
    const payment = await billingGracePaymentRepository.findByIdForAccount(input.id, account.accountId)
    if (!payment) throw new Error("Regularização não encontrada")
    return payment
  }
}

function buildAccountSummary(account: {
  accountId: string
  hasUnlimitedUsers: boolean
  hasPermanentSubscription: boolean
  teamCount: number
  distinctUserCount: number
  totalUsersIncludingMaster: number
}) {
  return buildBillingSummary(account.accountId, {
    hasUnlimitedUsers: account.hasUnlimitedUsers,
    hasPermanentSubscription: account.hasPermanentSubscription,
    teamCount: account.teamCount,
    distinctUserCount: account.distinctUserCount,
    totalUsersIncludingMaster: account.totalUsersIncludingMaster,
    includedExtraTeams: 0,
    includedExtraUsers: 0,
    manualAdjustmentExtraTeams: 0,
    manualAdjustmentExtraUsers: 0,
  })
}

export const billingGracePaymentService = new BillingGracePaymentService()
