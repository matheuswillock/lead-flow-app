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
import { readAbacatePublicKey, readConfiguredAbacatePublicKey } from "@/lib/payment-provider/public-key"

const ABACATE_CAPABILITIES = [
  "ONE_TIME_PAYMENT",
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
  return configured
}

async function readProviderSecret(environment: PaymentProviderEnvironment, suffix: string): Promise<string> {
  const environmentKey = `ABACATE_PAY_${environment}_${suffix}`
  const configured = (await paymentProviderConfigRepository.readRuntimeVariables("ABACATE_PAY", environment))[environmentKey]
  const value = configured ?? process.env[environmentKey] ?? process.env[`ABACATE_PAY_${suffix}`]
  if (!value?.trim()) throw new Error(`Segredo ${suffix} do provider não configurado`)
  return value
}

// A chave pública é configurada no backoffice por ambiente, com .env como fallback legado.
async function readProviderPublicKey(environment: PaymentProviderEnvironment): Promise<string | null> {
  return (await readConfiguredAbacatePublicKey(environment)) ?? readAbacatePublicKey(environment)
}

export async function resolveAbacateCapabilities(environment: PaymentProviderEnvironment) {
  const hasPublicKey = await readProviderPublicKey(environment) !== null
  return ABACATE_CAPABILITIES.filter((capability) => capability !== "CARD" || hasPublicKey)
}

export async function createAbacatePayProvider(
  environment: PaymentProviderEnvironment,
): Promise<AbacatePayProvider> {
  const publicKey = await readProviderPublicKey(environment)
  return new AbacatePayProvider(
    PaymentProviderConfig.create({
      apiKey: await readProviderSecret(environment, "API_KEY"),
      publicKey,
      webhookSecret: await readProviderSecret(environment, "WEBHOOK_SECRET"),
      // AbacatePay signs webhook payloads with the store public key. There is
      // no separate webhook-signing credential in the dashboard.
      webhookSigningKey: publicKey,
      environment,
      devMode: environment === "DEV",
    }),
  )
}

export async function createAbacatePayProviderRegistry(
  environment: PaymentProviderEnvironment,
): Promise<PaymentProviderRegistry> {
  return new PaymentProviderRegistry([
    {
      metadata: {
        key: "ABACATE_PAY",
        environment,
        capabilities: await resolveAbacateCapabilities(environment),
      },
    },
  ])
}

export async function createPaymentProviderRouter(
  environment: PaymentProviderEnvironment,
): Promise<PaymentProviderRouter> {
  return new PaymentProviderRouter(
    paymentProviderConfigRepository,
    await createAbacatePayProviderRegistry(environment),
  )
}

async function createUseCase() {
  const environment = resolvePaymentProviderEnvironment()
  const router = await createPaymentProviderRouter(environment)

  const service = new PaymentProviderPaymentService({
    purchases: platformPurchaseRepository,
    profiles: profileRepository,
    router,
    sessions: paymentProviderSessionRepository,
    identities: paymentProviderIdentityRepository,
    environment,
    resolveProvider: async ({ provider, environment: providerEnvironment }) => {
      if (provider !== "ABACATE_PAY") throw new Error("Provider não suportado nesta fase")
      return createAbacatePayProvider(providerEnvironment)
    },
  })
  return new PaymentProviderPaymentUseCase(service)
}

export async function getPaymentProviderPaymentUseCase() {
  return createUseCase()
}

export async function getPaymentProviderRefundUseCase(): Promise<PaymentProviderRefundUseCase> {
  const environment = resolvePaymentProviderEnvironment()
  return new PaymentProviderRefundUseCase({
    sessions: paymentProviderSessionRepository,
    refundService: new PaymentProviderPostPaymentService(paymentProviderSessionRepository),
    resolveProvider: async (providerEnvironment) => {
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
    resolveQueryProvider: async ({ provider, environment: providerEnvironment }) => {
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
