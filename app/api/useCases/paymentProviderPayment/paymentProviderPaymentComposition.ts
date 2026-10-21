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
import { derivePaymentProviderEnvironment } from "@/lib/payment-provider/environment"
import type { InstanceSelector, ResolvedCredentials } from "@/lib/payment-provider/credential-cache"
import {
  hydrateProviderCredentials,
  providerCredentialResolver,
} from "./providerCredentialRuntime"

const ABACATE_CAPABILITIES = [
  "ONE_TIME_PAYMENT",
  "PIX",
  "CARD",
  "STATUS_QUERY",
  "FULL_REFUND",
  "WEBHOOK",
] as const

export function resolvePaymentProviderEnvironment(): PaymentProviderEnvironment {
  const environment = derivePaymentProviderEnvironment(process.env)
  if (!environment) throw new Error("PAYMENT_PROVIDER_ENVIRONMENT inválido")
  return environment
}

function abacateSelector(environment: PaymentProviderEnvironment): InstanceSelector {
  return { provider: "ABACATE_PAY", environment }
}

/** Aquece o cache de credenciais (banco primeiro, ambiente como reserva) antes do uso síncrono. */
export async function hydrateAbacateCredentials(
  environment: PaymentProviderEnvironment,
): Promise<void> {
  await hydrateProviderCredentials(abacateSelector(environment))
}

function readProviderSecret(
  credentials: ResolvedCredentials,
  suffix: string,
): string {
  const value = credentials.values[suffix]
  if (!value?.trim()) throw new Error(`Segredo ${suffix} do provider não configurado`)
  return value
}

// Em PRODUCTION a chave pública só existe depois que a loja tem "Checkout próprio" (cartão)
// liberado. Em DEV ela é sempre obrigatória.
function readProviderPublicKey(
  environment: PaymentProviderEnvironment,
  credentials: ResolvedCredentials,
): string | null {
  if (environment !== "PRODUCTION") return readProviderSecret(credentials, "PUBLIC_KEY")
  return credentials.values.PUBLIC_KEY?.trim() ? credentials.values.PUBLIC_KEY : null
}

export function resolveAbacateCapabilities(environment: PaymentProviderEnvironment) {
  const credentials = providerCredentialResolver.resolveSync(abacateSelector(environment))
  const hasPublicKey = readProviderPublicKey(environment, credentials) !== null
  return ABACATE_CAPABILITIES.filter((capability) => capability !== "CARD" || hasPublicKey)
}

export function createAbacatePayProvider(
  environment: PaymentProviderEnvironment,
): AbacatePayProvider {
  const credentials = providerCredentialResolver.resolveSync(abacateSelector(environment))
  const publicKey = readProviderPublicKey(environment, credentials)
  return new AbacatePayProvider(
    PaymentProviderConfig.create({
      apiKey: readProviderSecret(credentials, "API_KEY"),
      publicKey,
      webhookSecret: readProviderSecret(credentials, "WEBHOOK_SECRET"),
      // AbacatePay signs webhook payloads with the store public key. There is
      // no separate webhook-signing credential in the dashboard.
      webhookSigningKey: publicKey,
      webhookSecretPrevious: credentials.values.WEBHOOK_SECRET_PREVIOUS ?? null,
      requireSignature: resolveRequireSignature(credentials),
      environment,
      devMode: environment === "DEV",
    }),
  )
}

function resolveRequireSignature(credentials: ResolvedCredentials): boolean {
  return (
    credentials.values.REQUIRE_SIGNATURE?.trim().toLowerCase() === "true" ||
    credentials.settings.requireSignature === true
  )
}

export function createAbacatePayProviderRegistry(
  environment: PaymentProviderEnvironment,
): PaymentProviderRegistry {
  return new PaymentProviderRegistry([
    {
      metadata: {
        key: "ABACATE_PAY",
        environment,
        capabilities: resolveAbacateCapabilities(environment),
      },
    },
  ])
}

/** Roteador que aquece as credenciais (capacidade de cartão depende da chave pública) antes de decidir. */
class CredentialAwarePaymentProviderRouter extends PaymentProviderRouter {
  constructor(private readonly environment: PaymentProviderEnvironment) {
    super(paymentProviderConfigRepository, createAbacatePayProviderRegistry(environment))
  }

  override async select(input: Parameters<PaymentProviderRouter["select"]>[0]) {
    await hydrateAbacateCredentials(this.environment)
    return new PaymentProviderRouter(
      paymentProviderConfigRepository,
      createAbacatePayProviderRegistry(this.environment),
    ).select(input)
  }
}

export function createPaymentProviderRouter(
  environment: PaymentProviderEnvironment,
): PaymentProviderRouter {
  return new CredentialAwarePaymentProviderRouter(environment)
}

function createUseCase() {
  const environment = resolvePaymentProviderEnvironment()
  const router = createPaymentProviderRouter(environment)

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

export async function getPaymentProviderRefundUseCase(): Promise<PaymentProviderRefundUseCase> {
  const environment = resolvePaymentProviderEnvironment()
  await hydrateAbacateCredentials(environment)
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

export async function getPaymentProviderMaintenanceUseCase(): Promise<PaymentProviderMaintenanceUseCase> {
  const environment = resolvePaymentProviderEnvironment()
  await hydrateAbacateCredentials(environment)
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
