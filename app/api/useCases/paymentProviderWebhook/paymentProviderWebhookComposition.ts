import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderEventInboxRepository } from "@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository"
import { paymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import { createPaymentOwnerSettlement } from "@/app/api/services/PaymentProviderPayment/paymentOwnerSettlementComposition"
import { createApplyPaymentEvent } from "./applyPaymentEvent"
import { reportPaymentDisputed } from "./reportPaymentDisputed"
import { reportRejectedConfirmation } from "./reportRejectedConfirmation"
import { reportUnknownOwnerType } from "./reportUnknownOwnerType"
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
  const settlement = createPaymentOwnerSettlement()
  const applyEvent = createApplyPaymentEvent({
    provider,
    sessions: paymentProviderSessionRepository,
    identities: paymentProviderIdentityRepository,
    purchases: platformPurchaseRepository,
    settlement,
    alerts: {
      unknownOwnerType: reportUnknownOwnerType,
      paymentDisputed: reportPaymentDisputed,
      confirmationRejected: reportRejectedConfirmation,
    },
    context: {
      environment,
      externalAccountContext: configuration.externalAccountContext,
      routeVersion: ROUTE_VERSION,
    },
  })
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
    applyEvent,
  })
  return { service, externalAccountContext: configuration.externalAccountContext }
}
