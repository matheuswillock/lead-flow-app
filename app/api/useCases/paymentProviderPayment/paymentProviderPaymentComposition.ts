import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { AbacatePayProvider } from "@/app/api/infra/providers/AbacatePayProvider"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import { PaymentProviderRegistry } from "@/lib/payment-provider/registry"
import { PaymentProviderRouter } from "@/lib/payment-provider/router"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"
import { PaymentProviderPaymentService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderPaymentService"
import { PaymentProviderPaymentUseCase } from "./PaymentProviderPaymentUseCase"
import { PaymentProviderPostPaymentService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderPostPaymentService"
import { PaymentProviderReconciliationService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderReconciliationService"
import { PaymentProviderMaintenanceService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"
import { PaymentProviderRefundUseCase } from "./PaymentProviderRefundUseCase"
import { PaymentProviderMaintenanceUseCase } from "./PaymentProviderMaintenanceUseCase"
import { applyEmailCreditsPaidPurchaseUseCase } from "@/app/api/useCases/email/ApplyEmailCreditsPaidPurchaseUseCase"

const ABACATE_CAPABILITIES = [
  "ONE_TIME_PAYMENT",
  "HOSTED_CHECKOUT",
  "PIX",
  "CARD",
  "STATUS_QUERY",
  "FULL_REFUND",
  "WEBHOOK",
] as const

export function resolvePaymentProviderEnvironment(): PaymentProviderEnvironment {
  const configured = process.env.PAYMENT_PROVIDER_ENVIRONMENT ?? "DEV"
  if (configured !== "DEV" && configured !== "PRODUCTION") {
    throw new Error("PAYMENT_PROVIDER_ENVIRONMENT inválido")
  }
  if (configured === "PRODUCTION") {
    throw new Error("A Fase 3 aceita somente o ambiente DEV")
  }
  return configured
}

function readProviderSecret(environment: PaymentProviderEnvironment, suffix: string): string {
  const environmentKey = `ABACATE_PAY_${environment}_${suffix}`
  const value = process.env[environmentKey] ?? process.env[`ABACATE_PAY_${suffix}`]
  if (!value?.trim()) throw new Error(`Segredo ${suffix} do provider não configurado`)
  return value
}

// Em PRODUCTION a chave pública só existe depois que a loja tem "Checkout próprio" (cartão)
// liberado. Em DEV ela é sempre obrigatória.
function readProviderPublicKey(environment: PaymentProviderEnvironment): string | null {
  if (environment !== "PRODUCTION") return readProviderSecret(environment, "PUBLIC_KEY")
  const value = process.env[`ABACATE_PAY_${environment}_PUBLIC_KEY`] ?? process.env.ABACATE_PAY_PUBLIC_KEY
  return value?.trim() ? value : null
}

function resolveAbacateCapabilities(environment: PaymentProviderEnvironment) {
  const hasPublicKey = readProviderPublicKey(environment) !== null
  return ABACATE_CAPABILITIES.filter((capability) => capability !== "CARD" || hasPublicKey)
}

export function createAbacatePayProvider(
  environment: PaymentProviderEnvironment,
): AbacatePayProvider {
  const publicKey = readProviderPublicKey(environment)
  return new AbacatePayProvider(
    PaymentProviderConfig.create({
      apiKey: readProviderSecret(environment, "API_KEY"),
      publicKey,
      webhookSecret: readProviderSecret(environment, "WEBHOOK_SECRET"),
      // AbacatePay signs webhook payloads with the store public key. There is
      // no separate webhook-signing credential in the dashboard.
      webhookSigningKey: publicKey,
      environment,
      devMode: environment === "DEV",
    }),
  )
}

function createUseCase() {
  const environment = resolvePaymentProviderEnvironment()
  const registry = new PaymentProviderRegistry([
    {
      metadata: {
        key: "ABACATE_PAY",
        environment,
        capabilities: resolveAbacateCapabilities(environment),
      },
    },
  ])
  const router = new PaymentProviderRouter(paymentProviderConfigRepository, registry)

  const service = new PaymentProviderPaymentService({
    purchases: platformPurchaseRepository,
    profiles: profileRepository,
    router,
    sessions: paymentProviderSessionRepository,
    identities: paymentProviderIdentityRepository,
    environment,
    resolveProvider: ({ provider, environment: providerEnvironment }) => {
      if (provider !== "ABACATE_PAY") throw new Error("Provider não suportado nesta fase")
      return createAbacatePayProvider(providerEnvironment)
    },
  })
  return new PaymentProviderPaymentUseCase(service)
}

export function getPaymentProviderPaymentUseCase() {
  return createUseCase()
}

export function getPaymentProviderRefundUseCase(): PaymentProviderRefundUseCase {
  const environment = resolvePaymentProviderEnvironment()
  return new PaymentProviderRefundUseCase({
    sessions: paymentProviderSessionRepository,
    refundService: new PaymentProviderPostPaymentService(paymentProviderSessionRepository),
    resolveProvider: (providerEnvironment) => {
      if (providerEnvironment !== environment) {
        throw new Error("Ambiente do provider não suportado nesta fase")
      }
      return createAbacatePayProvider(providerEnvironment)
    },
  })
}

export function getPaymentProviderMaintenanceUseCase(): PaymentProviderMaintenanceUseCase {
  const environment = resolvePaymentProviderEnvironment()
  const reconciliation = new PaymentProviderReconciliationService({
    sessions: paymentProviderSessionRepository,
    identities: paymentProviderIdentityRepository,
    purchases: platformPurchaseRepository,
  })
  const maintenance = new PaymentProviderMaintenanceService({
    sessions: paymentProviderSessionRepository,
    purchases: {
      findById: platformPurchaseRepository.findById.bind(platformPurchaseRepository),
      markPaidOnceForProvider: platformPurchaseRepository.markPaidOnceForProvider.bind(platformPurchaseRepository),
    },
    reconciliation,
    resolveQueryProvider: ({ provider, environment: providerEnvironment }) => {
      if (provider !== "ABACATE_PAY" || providerEnvironment !== environment) {
        throw new Error("Provider não suportado nesta fase")
      }
      return createAbacatePayProvider(providerEnvironment)
    },
    applyEmailCredits: ({ paymentId, checkoutId, productSlug }) =>
      applyEmailCreditsPaidPurchaseUseCase.apply({
        paymentId,
        checkoutId,
        productSlug,
      }),
    now: () => new Date(),
  })
  return new PaymentProviderMaintenanceUseCase(maintenance)
}
