import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import {
  createAbacatePayProvider,
  createPaymentProviderRouter,
  resolvePaymentProviderEnvironment,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import {
  currentlyHasUnlimitedUsers,
  quoteRenewal,
  quoteRenewalCycle,
  resolveRevokedUserIds,
  type RenewalAccount,
  type RenewalCycleQuote,
} from "@/app/api/shared/billing/renewalQuote"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import type { Prisma } from "@prisma/client"
import type { BillingGracePaymentQuote, IBillingGracePaymentService } from "./IBillingGracePaymentService"

const QUOTE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 60 * 1000
const ROUTE_VERSION = "BILLING-GRACE-PHASE-5"


/**
 * Prazos e preços vigentes do checkout (fonte única de preço da contratação e da renovação),
 * injetados pela composição do use case.
 */
export type RenewalCycleOptionsLoader = () => Promise<SelfCheckoutCycleOption[]>

export class BillingGracePaymentService implements IBillingGracePaymentService {
  constructor(private readonly loadCycleOptions: RenewalCycleOptionsLoader) {}

  async getQuote(supabaseId: string): Promise<BillingGracePaymentQuote> {
    const account = await billingGracePaymentRepository.findAccountContext(supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")
    if (account.hasPermanentSubscription) throw new Error("Assinatura vitalícia não tem renovação")

    const cycles = quoteRenewal(await this.loadCycleOptions(), account, new Date())
    if (cycles.length === 0) throw new Error("Nenhum prazo de renovação disponível no momento")

    return {
      cycles,
      currentCycle: account.currentCycle,
      hasUnlimitedUsers: currentlyHasUnlimitedUsers(account),
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      // Cartão na renovação ainda não tem rota de cobrança: liga aqui junto com POST /card.
      cardCheckout: null,
    }
  }

  /** Valor do prazo escolhido, recalculado no servidor (o navegador só envia o prazo). */
  private async quoteCycle(account: RenewalAccount, cycle: string, keptUserIds?: readonly string[]): Promise<RenewalCycleQuote> {
    const options = await this.loadCycleOptions()
    const option = options.find((item) => item.cycle === cycle)
    if (!option) throw new Error("Este prazo não está disponível. Escolha outro prazo.")
    if (keptUserIds) {
      const accountUserIds = new Set(account.extraUsers.map((user) => user.id))
      if (keptUserIds.some((id) => !accountUserIds.has(id))) {
        throw new Error("A lista de usuários mudou. Atualize a página e escolha de novo.")
      }
    }
    return quoteRenewalCycle(option, account, new Date(), keptUserIds)
  }

  async createPixPayment(input: { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[] }) {
    // Resolve a conta antes de qualquer consulta: a chave é do cliente e não pode revelar
    // nem devolver o pagamento (e o PIX) de outra conta.
    const account = await billingGracePaymentRepository.findAccountContext(input.supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")

    const existing = await billingGracePaymentRepository.findByIdempotencyKey({
      accountId: account.accountId,
      idempotencyKey: input.idempotencyKey,
    })
    if (existing) return existing

    // Seleciona o provider antes de persistir: provider indisponível não deixa linha órfã.
    const environment = resolvePaymentProviderEnvironment()
    const selected = await createPaymentProviderRouter(environment).select({
      environment,
      requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"],
    })

    if (account.hasPermanentSubscription) throw new Error("Assinatura vitalícia não tem renovação")
    const quote = await this.quoteCycle(account, input.cycle, input.keptUserIds)
    const revokedProfileIds = resolveRevokedUserIds(quote, account, input.keptUserIds)
    const amountCents = Math.round(quote.pixTotal * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
      throw new Error("Não foi possível calcular o valor da renovação")
    }
    const payment = await billingGracePaymentRepository.create({
      accountId: account.accountId,
      teamId: account.teamId,
      subscriptionId: account.subscriptionId,
      cycle: quote.cycle,
      revokedProfileIds,
      amountCents,
      effectivePriceCents: amountCents,
      provider: "ABACATE_PAY",
      providerEnvironment: environment,
      idempotencyKey: input.idempotencyKey,
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })

    const provider = createAbacatePayProvider(environment)
    // A unicidade das tentativas do provider é global: derivar a chave do pagamento
    // (único) evita colisão entre contas que enviem a mesma chave de cliente.
    const providerIdempotencyKey = `billing-grace-payment:${payment.id}`
    const session = await paymentProviderSessionRepository.createSession({
      tenantId: account.teamId ?? account.accountId,
      ownerType: "BILLING_GRACE_PAYMENT",
      ownerId: payment.id,
      idempotencyKey: providerIdempotencyKey,
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
      idempotencyKey: providerIdempotencyKey,
      requestFingerprint: JSON.stringify({ amountCents, method: "PIX", cycle: quote.cycle, revokedProfileIds, accountId: account.accountId }),
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
    const outcome = await provider.createPixPayment({
      amountInCents: amountCents,
      customer: {
        name: account.name,
        email: account.email,
        taxId: account.taxId,
        cellphone: account.cellphone,
      },
      externalReference: `${payment.id}:${attempt.id}`,
      metadata: { paymentId: payment.id, attemptId: attempt.id },
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
      ...(outcome.status === "PENDING" && "pix" in outcome
        ? { paymentInstructions: outcome.pix }
        : {}),
    })
    return billingGracePaymentRepository.attachProviderAttempt({
      id: payment.id,
      providerSessionId: session.id,
      providerAttemptId: updated.id,
      providerExternalId: updated.externalId,
      ...(updated.paymentInstructions
        ? { paymentInstructions: updated.paymentInstructions as Prisma.InputJsonValue }
        : {}),
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
