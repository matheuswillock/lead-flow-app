import { paymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/PaymentProviderCredentialRepository"
import { PaymentProviderInstancesUseCase } from "./PaymentProviderInstancesUseCase"
import { auditLogService } from "@/app/api/services/audit/AuditLogService"

export const paymentProviderInstancesUseCase = new PaymentProviderInstancesUseCase(
  paymentProviderCredentialRepository,
  auditLogService,
)
