import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/PaymentProviderCredentialRepository"
import { AuditLogRepository } from "@/app/api/infra/data/repositories/audit/AuditLogRepository"
import { PaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/PaymentProviderConfigService"
import {
  PaymentProviderHealthCheckService,
  type HealthCheckProviderFactory,
} from "@/app/api/services/PaymentProviderConfig/PaymentProviderHealthCheckService"
import { auditLogWriter } from "@/app/api/useCases/audit/AuditLogWriter"
import {
  createAbacatePayProvider,
  hydrateAbacateCredentials,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import {
  getCredentialCipher,
  invalidateProviderCredentialCache,
} from "@/app/api/useCases/paymentProviderPayment/providerCredentialRuntime"
import { createAsaasHealthCheck } from "@/lib/asaas/asaas-health"
import { PaymentProviderConfigUseCase } from "./PaymentProviderConfigUseCase"
import { PaymentProviderHealthCheckUseCase } from "./PaymentProviderHealthCheckUseCase"

const auditHistory = new AuditLogRepository()

const configService = new PaymentProviderConfigService(
  paymentProviderConfigRepository,
  paymentProviderCredentialRepository,
  {
    getCipher: getCredentialCipher,
    onChange: invalidateProviderCredentialCache,
    // CARD_PAYMENTS_ENABLED continua como reserva quando a instância não definiu cardEnabled.
    cardEnabledFallback: () => process.env.CARD_PAYMENTS_ENABLED !== "false",
  },
)

export const paymentProviderConfigUseCase = new PaymentProviderConfigUseCase(configService, {
  logAudit: (entry) => auditLogWriter.logAudit(entry),
  listHistory: (entityType, entityId, limit) => auditHistory.listByEntity(entityType, entityId, limit),
})

/** Sonda por adapter. Asaas: contexto da instância (primary/legacy) escolhe a conta. */
export const createInstanceHealthProbe: HealthCheckProviderFactory = async (instance) => {
  if (instance.provider === "ABACATE_PAY") {
    await hydrateAbacateCredentials(instance.environment)
    return createAbacatePayProvider(instance.environment)
  }
  if (instance.provider === "ASAAS") {
    if (instance.externalAccountContext === "primary" || instance.externalAccountContext === "legacy") {
      return createAsaasHealthCheck(instance.externalAccountContext)
    }
    throw new Error("Contexto de conta Asaas não suportado")
  }
  throw new Error("Health-check não suportado para este provider")
}

export const paymentProviderHealthCheckService = new PaymentProviderHealthCheckService(
  paymentProviderConfigRepository,
  createInstanceHealthProbe,
)

export const paymentProviderHealthCheckUseCase = new PaymentProviderHealthCheckUseCase(
  paymentProviderHealthCheckService,
  configService,
)
