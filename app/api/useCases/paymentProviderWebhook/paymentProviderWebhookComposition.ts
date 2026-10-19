import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderEventInboxRepository } from "@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository"
import { paymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import { PaymentProviderWebhookService } from "@/app/api/services/paymentProvider/PaymentProviderWebhookService"
import { PaymentProviderEventProcessor } from "@/lib/payment-provider/event-inbox"
import {
  createAbacatePayProvider,
  resolvePaymentProviderEnvironment,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"

const ROUTE_VERSION = "PAY-PROV-PHASE-3"

export async function createPaymentProviderWebhookService() {
  const environment = resolvePaymentProviderEnvironment()
  const configuration = (await paymentProviderConfigRepository.list(environment)).find(
    (item) => item.provider === "ABACATE_PAY",
  )
  if (!configuration) throw new Error("Configuração do provider não encontrada")

  const provider = createAbacatePayProvider(environment)
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
      }
    },
  })
  return { service, externalAccountContext: configuration.externalAccountContext }
}
