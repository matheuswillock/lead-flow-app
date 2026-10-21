import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderEventInboxRepository } from "@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository"
import { paymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import { createPaymentOwnerSettlement } from "@/app/api/services/PaymentProviderPayment/paymentOwnerSettlementComposition"
import { createOwnerChargeMirror } from "@/app/api/services/paymentCharge/paymentChargeComposition"
import { reportUnknownOwnerType } from "./reportUnknownOwnerType"
import { backofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import { applyEmailCreditsPaidPurchaseUseCase } from "@/app/api/useCases/email/ApplyEmailCreditsPaidPurchaseUseCase"
import { ApplyEmailCreditsOnConfirmation } from "./applyEmailCreditsOnConfirmation"
import { PaymentEventMatchGuard } from "./paymentEventMatchGuard"
import { reportPaymentDisputed } from "./reportPaymentDisputed"
import { PaymentProviderWebhookService } from "@/app/api/services/paymentProvider/PaymentProviderWebhookService"
import { pickPrimaryInstance } from "@/lib/payment-provider/instance"
import { PaymentProviderEventProcessor } from "@/lib/payment-provider/event-inbox"
import {
  createAbacatePayProvider,
  hydrateAbacateCredentials,
  resolvePaymentProviderEnvironment,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"

const ROUTE_VERSION = "PAY-PROV-PHASE-3"

export async function createPaymentProviderWebhookService() {
  const environment = resolvePaymentProviderEnvironment()
  // Várias instâncias por provider são permitidas: o webhook atende a instância principal.
  const configuration = pickPrimaryInstance(
    await paymentProviderConfigRepository.list(environment),
    "ABACATE_PAY",
  )
  if (!configuration) throw new Error("Configuração do provider não encontrada")

  await hydrateAbacateCredentials(environment)
  const provider = createAbacatePayProvider(environment)
  const settlement = createPaymentOwnerSettlement()
  const eventMatchGuard = new PaymentEventMatchGuard({
    purchases: platformPurchaseRepository,
    adhesionPayments: backofficeAdhesionPaymentRepository,
    gracePayments: billingGracePaymentRepository,
  })
  const emailCreditsOnConfirmation = new ApplyEmailCreditsOnConfirmation({
    purchases: platformPurchaseRepository,
    applyEmailCredits: (input) => applyEmailCreditsPaidPurchaseUseCase.apply(input),
  })
  const ledgerMirror = createOwnerChargeMirror()
  const eventProcessor = new PaymentProviderEventProcessor(paymentProviderEventInboxRepository)
  const service = new PaymentProviderWebhookService({
    provider,
    providerKey: "ABACATE_PAY",
    environment,
    eventProcessor,
    getCurrentStatus: async (externalPaymentId) => {
      const attempt = await paymentProviderSessionRepository.findAttemptByExternalId({
        externalId: externalPaymentId,
        provider: "ABACATE_PAY",
        environment,
        externalAccountContext: configuration.externalAccountContext,
      })
      return attempt?.status ?? "UNKNOWN"
    },
    applyEvent: async ({ event, nextStatus, claimToken }) => {
      // Resolve the attempt by provider charge id, or fall back to the
      // attempt-unique correlation from the webhook metadata (indeterminate
      // initiations that never received the charge id).
      const attemptById = event.externalPaymentId
        ? await paymentProviderSessionRepository.findAttemptByExternalId({
            externalId: event.externalPaymentId,
            provider: "ABACATE_PAY",
            environment,
            externalAccountContext: configuration.externalAccountContext,
          })
        : null
      const attemptByCorrelation = !attemptById && event.attemptId
        ? await paymentProviderSessionRepository.findAttemptById(event.attemptId)
        : null
      const attempt = attemptById ?? attemptByCorrelation
      if (!attempt) throw new Error("Tentativa não encontrada para o evento")
      // Validate the correlated attempt belongs to this provider/env/account
      if (attemptByCorrelation) {
        if (
          attempt.provider !== "ABACATE_PAY" ||
          attempt.environment !== environment ||
          attempt.externalAccountContext !== configuration.externalAccountContext
        ) {
          throw new Error("Tentativa correlacionada não pertence a este provider")
        }
      }

      // Valor e método do evento conferidos contra o dono antes de qualquer efeito (PAY-HARD-T011).
      await eventMatchGuard.assertMatches(attempt, event)

      // The fenced attempt transition (via claimToken) is the authority.
      // Only after winning the transition do we bind the identity and
      // activate the purchase — so a concurrent refund cannot win the CAS
      // and leave the purchase paid while the attempt becomes REFUNDED.
      await paymentProviderSessionRepository.applyEventWithClaim({
        externalId: event.externalPaymentId!,
        attemptId: attemptByCorrelation ? attempt.id : undefined,
        provider: "ABACATE_PAY",
        environment,
        externalAccountContext: configuration.externalAccountContext,
        expectedStatus: attempt.status,
        nextStatus,
        claimToken,
        now: new Date(),
      })

      await paymentProviderIdentityRepository.bind({
        provider: "ABACATE_PAY",
        environment,
        externalAccountContext: configuration.externalAccountContext,
        externalId: event.externalPaymentId!,
        identityType: "PAYMENT",
        ownerType: attempt.ownerType,
        ownerId: attempt.ownerId,
        tenantId: attempt.tenantId,
        route: "NEW_ROUTER",
        routeVersion: ROUTE_VERSION,
      })

      if (nextStatus === "CONFIRMED" && attempt.ownerType === "PLATFORM_PURCHASE") {
        await platformPurchaseRepository.markPaidOnceForProvider({
          id: attempt.ownerId,
          provider: "ABACATE_PAY",
          externalId: event.externalPaymentId!,
        })
        // Espelho no ledger: nunca lança e nunca altera o efeito acima.
        await ledgerMirror.mirrorSettled({
          ownerType: attempt.ownerType,
          ownerId: attempt.ownerId,
          externalId: event.externalPaymentId!,
          paidAt: new Date(),
        })
      }
      if (nextStatus === "CONFIRMED" && attempt.ownerType !== "PLATFORM_PURCHASE") {
        const settled = await settlement.settleConfirmed({
          ownerType: attempt.ownerType,
          ownerId: attempt.ownerId,
          externalId: event.externalPaymentId!,
          amountInCents: event.amountInCents,
          paidAt: new Date(),
        })
        // Pagamento confirmado sem efeito de domínio conhecido não pode passar em silêncio.
        if (settled === "unsupported") reportUnknownOwnerType(attempt)
      }
      if (nextStatus === "CONFIRMED" && attempt.ownerType === "PLATFORM_PURCHASE") {
        await emailCreditsOnConfirmation.apply({
          purchaseId: attempt.ownerId,
          externalId: event.externalPaymentId!,
        })
      }
      if (nextStatus === "DISPUTED") {
        await reportPaymentDisputed({
          attemptId: attempt.id,
          ownerType: attempt.ownerType,
          ownerId: attempt.ownerId,
          chargeId: event.externalPaymentId!,
          eventId: event.eventId,
        })
      }
    },
  })
  return { service, externalAccountContext: configuration.externalAccountContext }
}
