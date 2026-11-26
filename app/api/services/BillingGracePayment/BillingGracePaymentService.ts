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
import { normalizeRenewalCycle } from "@/lib/payment-provider/renewal-cycle"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import type { Prisma } from "@prisma/client"
import { readConfiguredAbacatePublicKey } from "@/lib/payment-methods/availability"
import { assertBillingTypeAllowed } from "@/lib/payment-methods/availability"
import { resolveCardAvailability } from "@/lib/payment-methods/availability"
import type { BillingGraceTermsAcceptance, BillingGracePaymentQuote, IBillingGracePaymentService } from "./IBillingGracePaymentService"

const QUOTE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 60 * 1000
const ROUTE_VERSION = "BILLING-GRACE-PHASE-5"


/**
 * Prazos e preços vigentes do checkout (fonte única de preço da contratação e da renovação),
 * injetados pela composição do use case.
 */
export type RenewalCycleOptionsLoader = () => Promise<SelfCheckoutCycleOption[]>

export class BillingGracePaymentService implements IBillingGracePaymentService {
  constructor(
    private readonly loadCycleOptions: RenewalCycleOptionsLoader,
    /** Passa a conta legada do Asaas para o roteador quando a renovação é confirmada na hora (cartão). */
    private readonly legacyAsaasCutover?: { cutOver(profileId: string, provider: string): Promise<void> },
  ) {}

  async getQuote(supabaseId: string): Promise<BillingGracePaymentQuote> {
    const account = await billingGracePaymentRepository.findAccountContext(supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")
    if (account.hasPermanentSubscription) throw new Error("Assinatura vitalícia não tem renovação")

    const cycles = quoteRenewal(await this.loadCycleOptions(), account, new Date())
    if (cycles.length === 0) throw new Error("Nenhum prazo de renovação disponível no momento")

    const availability = await resolveCardAvailability()
    const publicKey = availability.card ? await readConfiguredAbacatePublicKey() : null
    return {
      cycles,
      // Conta legada guarda YEARLY/SEMIANNUALLY: a tela pré-seleciona pelo prazo da tabela do checkout.
      currentCycle: normalizeRenewalCycle(account.currentCycle),
      hasUnlimitedUsers: currentlyHasUnlimitedUsers(account),
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      cardCheckout: publicKey ? {
        publicKey,
        payer: { name: account.name, email: account.email, taxId: account.taxId, cellphone: account.cellphone },
      } : null,
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

  async createPixPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[] }) {
    return this.startPayment({ ...input, method: "PIX" })
  }

  async createCardPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; cardToken: string; installments: number }) {
    if (!input.cardToken.startsWith("ctok_")) throw new Error("Token de cartão inválido")
    await assertBillingTypeAllowed("CREDIT_CARD")
    return this.startPayment({ ...input, method: "CARD" })
  }

  private async startPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; method: "PIX" | "CARD"; cardToken?: string; installments?: number }) {
    // Resolve a conta antes de qualquer consulta: a chave é do cliente e não pode revelar
    // nem devolver o pagamento (e o PIX) de outra conta.
    const account = await billingGracePaymentRepository.findAccountContext(input.supabaseId)
    if (!account) throw new Error("Somente o master pode regularizar esta conta")

    const existing = await billingGracePaymentRepository.findByIdempotencyKey({
      accountId: account.accountId,
      idempotencyKey: input.idempotencyKey,
    })
    if (existing) {
      const instructions = existing.paymentInstructions as { method?: unknown; brCode?: unknown } | null
      const existingMethod = instructions?.method === "CARD" || instructions?.brCode ? "PIX" : null
      if (existingMethod && existingMethod !== input.method) {
        throw new Error("A chave de idempotência já foi usada com outra forma de pagamento")
      }
      return existing
    }

    // Seleciona o provider antes de persistir: provider indisponível não deixa linha órfã.
    const environment = resolvePaymentProviderEnvironment()
    const router = await createPaymentProviderRouter(environment)
    const selected = await router.select({
      environment,
      requiredCapabilities: ["ONE_TIME_PAYMENT", input.method],
    })

    if (account.hasPermanentSubscription) throw new Error("Assinatura vitalícia não tem renovação")
    const quote = await this.quoteCycle(account, input.cycle, input.keptUserIds)
    const revokedProfileIds = resolveRevokedUserIds(quote, account, input.keptUserIds)
    if (input.method === "CARD" && (input.installments ?? 1) > quote.maxInstallments) {
      throw new Error("Parcelamento indisponível para este prazo")
    }
    const total = input.method === "CARD" ? quote.cardTotal : quote.pixTotal
    if (total == null) throw new Error("Pagamento com cartão indisponível para este prazo")
    const amountCents = Math.round(total * 100)
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
      provider: selected.provider,
      providerEnvironment: environment,
      idempotencyKey: input.idempotencyKey,
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      termsAcceptedAt: input.termsAcceptedAt,
      termsVersion: input.termsVersion,
    })

    const provider = await createAbacatePayProvider(environment, selected.externalAccountContext)
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
      requestFingerprint: JSON.stringify({ amountCents, method: input.method, cycle: quote.cycle, revokedProfileIds, accountId: account.accountId, installments: input.installments ?? 1 }),
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
    const common = {
      amountInCents: amountCents,
      customer: {
        name: account.name,
        email: account.email,
        taxId: account.taxId,
        cellphone: account.cellphone,
      },
      externalReference: `${payment.id}:${attempt.id}`,
      metadata: { paymentId: payment.id, attemptId: attempt.id },
    }
    const outcome = input.method === "PIX"
      ? await provider.createPixPayment(common)
      : await provider.createCardPayment({ ...common, token: input.cardToken!, tokenIssuedAt: new Date(), installments: input.installments })
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
    const attached = await billingGracePaymentRepository.attachProviderAttempt({
      id: payment.id,
      providerSessionId: session.id,
      providerAttemptId: updated.id,
      providerExternalId: updated.externalId,
      ...(input.method === "CARD"
        ? { paymentInstructions: { method: "CARD" } as Prisma.InputJsonValue }
        : updated.paymentInstructions
          ? { paymentInstructions: { ...(updated.paymentInstructions as object), method: "PIX" } as Prisma.InputJsonValue }
          : {}),
    })
    if (outcome.status === "FAILED") return (await billingGracePaymentRepository.markFailed(payment.id, "Pagamento não aprovado")) ?? attached
    if (outcome.status === "CONFIRMED" && "externalId" in outcome && outcome.externalId) {
      const confirmed = await billingGracePaymentRepository.markConfirmed({
        id: payment.id,
        providerExternalId: outcome.externalId,
        confirmedAt: new Date(),
      })
      if (confirmed) {
        const completed = (await billingGracePaymentRepository.completeAndRestoreAccess(confirmed.id)) ?? confirmed
        await this.cutOverLegacyAsaas(completed)
        return completed
      }
    }
    return attached
  }

  /** Melhor esforço: o pagamento já foi aplicado, e a reentrega do evento do provedor repete o corte. */
  private async cutOverLegacyAsaas(payment: { accountId: string; provider: string }) {
    try {
      await this.legacyAsaasCutover?.cutOver(payment.accountId, payment.provider)
    } catch (error) {
      console.error("[BillingGracePaymentService] falha no corte do Asaas após a renovação", { accountId: payment.accountId, error })
    }
  }

  async getPayment(input: { id: string; supabaseId: string }) {
    const account = await billingGracePaymentRepository.findAccountContext(input.supabaseId)
    if (!account) throw new Error("Somente o master pode consultar esta regularização")
    const payment = await billingGracePaymentRepository.findByIdForAccount(input.id, account.accountId)
    if (!payment) throw new Error("Regularização não encontrada")
    return payment
  }
}
