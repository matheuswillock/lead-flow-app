import { emailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { IEmailCreditService } from "@/app/api/services/EmailCredit/IEmailCreditService"
import {
  platformPurchaseRepository,
} from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import type { IPlatformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import { parsePlatformPurchaseExternalReference } from "@/lib/billing/platform-purchase-external-reference"
import { parseEmailCreditsPlanFromProductSlug } from "@/lib/email/email-credit-plans"
import type { EmailCreditPlan, PlatformPurchase } from "@prisma/client"
import { Output } from "@/lib/output"
import type { AsaasAccountId } from "@/lib/asaas"

export type ApplyEmailCreditsPaidPurchaseInput = {
  paymentId: string
  externalReference?: string | null
  teamId?: string
  plan?: EmailCreditPlan
  checkoutId?: string
  productSlug?: string | null
  timezone?: string | null
  // E4 (C33 "5º ponto"): fallback por paymentId (findByAsaasPaymentId) MUST
  // filtrar por conta — o checkoutId/externalReference já são seguros (IDs
  // nossos, não do Asaas), mas o fallback lê um pay_ que pode colidir entre
  // as duas contas. Default primary preserva o comportamento pré-E4 quando
  // o chamador não propaga a conta do evento.
  account?: AsaasAccountId
}

export type ApplyEmailCreditsPaidPurchaseResult = {
  handled: boolean
  applied: boolean
  alreadyApplied: boolean
  teamId?: string
  plan?: EmailCreditPlan
}

function planFromMetadata(metadata: unknown): EmailCreditPlan | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const plan = (metadata as { plan?: unknown }).plan
  if (
    plan === "starter" ||
    plan === "plus" ||
    plan === "pro" ||
    plan === "upgrade" ||
    plan === "business"
  ) {
    return plan
  }
  return null
}

/**
 * Aplica créditos de e-mail após `PlatformCheckoutUseCase.applyPaidPurchase`.
 * Fonte canônica da compra: `PlatformPurchase` (purchaseType=email_credits).
 * Idempotência de créditos: `EmailCreditPaymentGrant.paymentId`.
 */
export class ApplyEmailCreditsPaidPurchaseUseCase {
  constructor(
    private readonly creditService: IEmailCreditService = emailCreditService,
    private readonly purchaseRepository: IPlatformPurchaseRepository = platformPurchaseRepository
  ) {}

  async execute(input: ApplyEmailCreditsPaidPurchaseInput): Promise<Output> {
    const result = await this.apply(input)
    return new Output(
      true,
      result.applied
        ? ["Créditos de e-mail aplicados"]
        : result.alreadyApplied
          ? ["Pagamento de créditos já aplicado"]
          : result.handled
            ? ["Compra de créditos reconhecida sem aplicação"]
            : [],
      [],
      result
    )
  }

  async apply(
    input: ApplyEmailCreditsPaidPurchaseInput
  ): Promise<ApplyEmailCreditsPaidPurchaseResult> {
    const paymentId = input.paymentId?.trim()
    if (!paymentId) {
      return { handled: false, applied: false, alreadyApplied: false }
    }

    let purchase: PlatformPurchase | null = null

    if (input.checkoutId?.trim()) {
      purchase = await this.purchaseRepository.findById(input.checkoutId.trim())
    }

    if (!purchase && input.externalReference) {
      const purchaseId = parsePlatformPurchaseExternalReference(input.externalReference)
      if (purchaseId) {
        purchase = await this.purchaseRepository.findById(purchaseId)
      }
      if (!purchase) {
        purchase = await this.purchaseRepository.findByExternalReference(input.externalReference)
      }
    }

    if (!purchase) {
      purchase = await this.purchaseRepository.findByAsaasPaymentId(paymentId, input.account ?? "primary")
    }

    if (!purchase) {
      if (input.teamId && input.plan) {
        const applyResult = await this.creditService.applyPaidPlan({
          teamId: input.teamId,
          plan: input.plan,
          paymentId,
          checkoutId: input.checkoutId,
          timezone: input.timezone,
          account: input.account,
        })
        return {
          handled: true,
          applied: applyResult.applied,
          alreadyApplied: applyResult.alreadyApplied,
          teamId: input.teamId,
          plan: input.plan,
        }
      }
      return { handled: false, applied: false, alreadyApplied: false }
    }

    if (purchase.purchaseType !== "email_credits") {
      return { handled: false, applied: false, alreadyApplied: false }
    }

    const teamId = input.teamId?.trim() || purchase.teamId
    const plan =
      input.plan ??
      planFromMetadata(purchase.metadata) ??
      parseEmailCreditsPlanFromProductSlug(input.productSlug ?? purchase.productSlug)

    if (!teamId || !plan) {
      console.warn("[ApplyEmailCreditsPaidPurchaseUseCase] compra sem teamId/plan resolvíveis", {
        paymentId,
        purchaseId: purchase.id,
        teamId,
        productSlug: purchase.productSlug,
      })
      return { handled: true, applied: false, alreadyApplied: false }
    }

    const applyResult = await this.creditService.applyPaidPlan({
      teamId,
      plan,
      paymentId,
      checkoutId: purchase.id,
      timezone: input.timezone,
      account: input.account,
    })

    console.info("[ApplyEmailCreditsPaidPurchaseUseCase]", {
      paymentId,
      teamId,
      plan,
      purchaseId: purchase.id,
      applied: applyResult.applied,
      alreadyApplied: applyResult.alreadyApplied,
    })

    return {
      handled: true,
      applied: applyResult.applied,
      alreadyApplied: applyResult.alreadyApplied,
      teamId,
      plan,
    }
  }
}

export const applyEmailCreditsPaidPurchaseUseCase =
  new ApplyEmailCreditsPaidPurchaseUseCase()
