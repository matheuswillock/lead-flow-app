import type { IPlatformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import type { IPaymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/IPaymentProviderIdentityRepository"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { PaymentProviderRouter } from "@/lib/payment-provider/router"
import type { OneTimePaymentCapability } from "@/lib/payment-provider/contracts"
import type {
  PaymentAttemptStatus,
  PaymentProviderEnvironment,
  PaymentMethod,
} from "@/lib/payment-provider/types"
import type { PlatformPurchaseStatus } from "@prisma/client"
import type {
  IPaymentProviderPaymentService,
  StartPaymentInput,
  StartedPayment,
} from "./IPaymentProviderPaymentService"

const ROUTE_VERSION = "PAY-PROV-PHASE-3"
const SESSION_TTL_MS = 30 * 60 * 1000
const PAYMENT_LEASE_TTL_MS = 60 * 1000

type ProviderResolver = (input: {
  readonly provider: "ASAAS" | "ABACATE_PAY"
  readonly environment: PaymentProviderEnvironment
}) => OneTimePaymentCapability

export type PaymentProviderPaymentServiceDependencies = {
  readonly purchases: Pick<IPlatformPurchaseRepository, "findById" | "markPaidOnceForProvider">
  readonly profiles: Pick<IProfileRepository, "findBySupabaseId">
  readonly router: Pick<PaymentProviderRouter, "select">
  readonly sessions: IPaymentProviderSessionRepository
  readonly identities: IPaymentProviderIdentityRepository
  readonly resolveProvider: ProviderResolver
  readonly environment?: PaymentProviderEnvironment
  readonly now?: () => Date
}

export class PaymentProviderPaymentService implements IPaymentProviderPaymentService {
  private readonly now: () => Date
  private readonly environment: PaymentProviderEnvironment

  constructor(private readonly dependencies: PaymentProviderPaymentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date())
    this.environment = dependencies.environment ?? "DEV"
  }

  async startPayment(input: StartPaymentInput): Promise<StartedPayment> {
    validateInput(input)
    const profile = await this.dependencies.profiles.findBySupabaseId(input.supabaseId)
    if (!profile) throw new Error("Usuário não encontrado")

    const purchase = await this.dependencies.purchases.findById(input.purchaseId)
    if (!purchase || purchase.profileId !== profile.id) throw new Error("Checkout não encontrado")
    if (purchase.status === "paid") throw new Error("Checkout já foi pago")

    const method = resolveMethod(purchase.billingType, input.method)
    const amountInCents = toCents(purchase.amount)
    const selected = await this.dependencies.router.select({
      environment: this.environment,
      requiredCapabilities: ["ONE_TIME_PAYMENT", method],
    })
    const provider = this.dependencies.resolveProvider({
      provider: selected.provider,
      environment: selected.environment,
    })
    const now = this.now()
    const tenantId = purchase.teamId ?? purchase.profileId
    const session = await this.dependencies.sessions.createSession({
      tenantId,
      ownerType: "PLATFORM_PURCHASE",
      ownerId: purchase.id,
      idempotencyKey: input.idempotencyKey.trim(),
      provider: selected.provider,
      environment: selected.environment,
      externalAccountContext: selected.externalAccountContext,
      route: "NEW_ROUTER",
      routeVersion: ROUTE_VERSION,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    })
    const attempt = await this.dependencies.sessions.createAttempt({
      sessionId: session.id,
      tenantId,
      ownerType: "PLATFORM_PURCHASE",
      ownerId: purchase.id,
      now,
      attemptNumber: 1,
      idempotencyKey: input.idempotencyKey.trim(),
      requestFingerprint: createRequestFingerprint(input, amountInCents),
      provider: selected.provider,
      environment: selected.environment,
      externalAccountContext: selected.externalAccountContext,
    })

    if (attempt.status !== "CREATED") {
      return toStartedPayment(attempt, method, amountInCents, purchase.status)
    }

    const leasedAttempt = await this.dependencies.sessions.acquireAttemptLease({
      attemptId: attempt.id,
      tenantId,
      ownerType: "PLATFORM_PURCHASE",
      ownerId: purchase.id,
      purpose: "PAYMENT",
      now,
      ttlMs: PAYMENT_LEASE_TTL_MS,
    })
    const outcome = await createProviderPayment(provider, method, input, purchase, amountInCents)

    if (outcome.status === "UNKNOWN") {
      const updated = await this.dependencies.sessions.updateAttemptWithLease({
        attemptId: leasedAttempt.id,
        tenantId,
        ownerType: "PLATFORM_PURCHASE",
        ownerId: purchase.id,
        lease: leasedAttempt.lease,
        now: this.now(),
        status: "UNKNOWN",
        expectedStatus: "CREATED",
        operation: "PAYMENT",
        ...(outcome.externalId ? { externalId: outcome.externalId } : {}),
        unknownReason: outcome.reason,
      })
      return {
        ...toStartedPayment(updated, method, amountInCents, purchase.status),
        requiresReconciliation: true,
        reason: outcome.reason,
      }
    }

    if (outcome.externalId) {
      await this.dependencies.identities.bind({
        provider: selected.provider,
        environment: selected.environment,
        externalAccountContext: selected.externalAccountContext,
        externalId: outcome.externalId,
        identityType: "PAYMENT",
        ownerType: "PLATFORM_PURCHASE",
        ownerId: purchase.id,
        tenantId,
        route: "NEW_ROUTER",
        routeVersion: ROUTE_VERSION,
      })
    }

    let purchaseStatus: PlatformPurchaseStatus = purchase.status
    if (outcome.status === "CONFIRMED" && outcome.externalId) {
      await this.dependencies.purchases.markPaidOnceForProvider({
        id: purchase.id,
        provider: selected.provider,
        externalId: outcome.externalId,
        paidAt: this.now(),
      })
      purchaseStatus = "paid"
    }

    const updated = await this.dependencies.sessions.updateAttemptWithLease({
      attemptId: leasedAttempt.id,
      tenantId,
      ownerType: "PLATFORM_PURCHASE",
      ownerId: purchase.id,
      lease: leasedAttempt.lease,
      now: this.now(),
      status: outcome.status,
      expectedStatus: "CREATED",
      operation: "PAYMENT",
      ...(outcome.externalId ? { externalId: outcome.externalId } : {}),
    })
    return toStartedPayment(updated, method, amountInCents, purchaseStatus, outcome)
  }
}

function validateInput(input: StartPaymentInput): void {
  if (!input.purchaseId.trim()) throw new Error("purchaseId é obrigatório")
  if (!input.supabaseId.trim()) throw new Error("supabaseId é obrigatório")
  if (!/^[^\s]{1,128}$/.test(input.idempotencyKey.trim())) {
    throw new Error("idempotencyKey inválida")
  }
  if (input.method !== "PIX" && input.method !== "CARD") throw new Error("Método inválido")
  if (!input.customer.name.trim() || !input.customer.email.trim()) {
    throw new Error("Dados do cliente incompletos")
  }
  if (input.method === "CARD") {
    if (!input.cardToken?.startsWith("ctok_")) throw new Error("Token de cartão obrigatório")
    if (!input.tokenIssuedAt || Number.isNaN(Date.parse(input.tokenIssuedAt))) {
      throw new Error("Data do token de cartão inválida")
    }
  }
}

function resolveMethod(billingType: string | null, requestedMethod: PaymentMethod): PaymentMethod {
  const expected = billingType === "CREDIT_CARD" ? "CARD" : billingType === "PIX" ? "PIX" : null
  if (expected !== requestedMethod) throw new Error("Método incompatível com o checkout")
  return requestedMethod
}

function toCents(amount: unknown): number {
  const value = typeof amount === "object" && amount !== null ? amount.toString() : String(amount)
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Valor do checkout inválido")
  const cents = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(cents) || cents < 100) throw new Error("Valor do checkout inválido")
  return cents
}

function createRequestFingerprint(input: StartPaymentInput, amountInCents: number): string {
  return JSON.stringify({
    purchaseId: input.purchaseId,
    method: input.method,
    amountInCents,
    customer: input.customer,
    installments: input.installments ?? null,
    hasCardToken: Boolean(input.cardToken),
  })
}

async function createProviderPayment(
  provider: OneTimePaymentCapability,
  method: PaymentMethod,
  input: StartPaymentInput,
  purchase: { externalReference: string; productSlug: string },
  amountInCents: number,
) {
  const common = {
    amountInCents,
    customer: input.customer,
    externalReference: purchase.externalReference,
    metadata: { purchaseId: input.purchaseId, productSlug: purchase.productSlug },
  }
  if (method === "PIX") return provider.createPixPayment(common)
  return provider.createCardPayment({
    ...common,
    token: input.cardToken!,
    tokenIssuedAt: new Date(input.tokenIssuedAt!),
    installments: input.installments,
  })
}

function toStartedPayment(
  attempt: {
    id: string
    sessionId: string
    provider: "ASAAS" | "ABACATE_PAY"
    environment: "DEV" | "PRODUCTION"
    status: PaymentAttemptStatus
    externalId: string | null
  },
  method: PaymentMethod,
  amountInCents: number,
  purchaseStatus: PlatformPurchaseStatus,
  outcome?: {
    pix?: StartedPayment["pix"]
  },
): StartedPayment {
  return {
    sessionId: attempt.sessionId,
    attemptId: attempt.id,
    provider: attempt.provider,
    environment: attempt.environment,
    status: attempt.status,
    externalId: attempt.externalId,
    amountInCents,
    currency: "BRL",
    method,
    purchaseStatus,
    ...(outcome?.pix ? { pix: outcome.pix } : {}),
  }
}
