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
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import type { RawWebhookRequest } from "@/lib/payment-provider/contracts"
import {
  createAbacatePayProvider,
  resolvePaymentProviderEnvironment,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"

const ROUTE_VERSION = "PAY-PROV-PHASE-3"

export async function createPaymentProviderWebhookService(request: RawWebhookRequest) {
  const environment = resolvePaymentProviderEnvironment()
  const configurations = (await paymentProviderConfigRepository.list(environment)).filter(
    (item) => item.provider === "ABACATE_PAY",
  )
  if (configurations.length === 0) throw new Error("Configuração do provider não encontrada")

  const matches = []
  for (const configuration of configurations) {
    const provider = await createAbacatePayProvider(environment, configuration.externalAccountContext)
    try {
      provider.verifyRequest(request)
      matches.push({ configuration, provider })
    } catch (error) {
      if (!(error instanceof PaymentProviderError) || error.code !== "WEBHOOK_INVALID") throw error
    }
  }
  if (matches.length !== 1) {
    throw new PaymentProviderError("WEBHOOK_INVALID", "Webhook não autenticado")
  }
  const { configuration, provider } = matches[0]

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
