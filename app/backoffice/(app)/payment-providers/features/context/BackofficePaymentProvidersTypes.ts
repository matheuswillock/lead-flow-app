import type {
  ProviderAdapterView,
  ProviderCredentialFieldView,
  ProviderCredentialView,
  ProviderHistoryItem,
  ProviderInstanceSettingsView,
  ProviderInstanceView,
  ProviderSettingKey,
} from "@/lib/payment-provider/admin-contract"
import type { ProviderHealthStatus } from "@/lib/payment-provider/routing-config"
import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

// Os formatos que cruzam a API vêm do contrato do backend: uma só fonte, sem cópia que possa divergir.
export type {
  PaymentProviderEnvironment,
  PaymentProviderKey,
  ProviderAdapterView,
  ProviderCredentialFieldView as ProviderAdapterCredentialField,
  ProviderCredentialView,
  ProviderHealthStatus,
  ProviderHistoryItem,
  ProviderInstanceSettingsView as ProviderInstanceSettings,
  ProviderInstanceView,
  ProviderRolloutState,
}

export type ApplicableSetting = ProviderSettingKey

export interface CreateProviderInstanceInput {
  providerKey: PaymentProviderKey
  environment: PaymentProviderEnvironment
  externalAccountContext: string
  displayName: string
  logoUrl?: string
  logoAltText?: string
}

export interface UpdateProviderInstanceInput {
  id: string
  expectedRevision: number
  enabled?: boolean
  isDefault?: boolean
  externalAccountContext?: string
  rolloutState?: ProviderRolloutState
  killSwitch?: boolean
  displayName?: string
  logoUrl?: string
  logoAltText?: string
  settings?: Partial<ProviderInstanceSettingsView>
}

export const PAYMENT_PROVIDER_ENVIRONMENTS: PaymentProviderEnvironment[] = ["DEV", "PRODUCTION"]

export const ENVIRONMENT_LABELS: Record<PaymentProviderEnvironment, string> = {
  DEV: "Desenvolvimento",
  PRODUCTION: "Produção",
}

export const ROLLOUT_LABELS: Record<ProviderRolloutState, string> = {
  DISABLED: "Desativado",
  SANDBOX_VALIDATED: "Sandbox validado",
  APPROVED: "Aprovado",
  ACTIVE: "Ativo",
}

export const ROLLOUT_STATES: ProviderRolloutState[] = [
  "DISABLED",
  "SANDBOX_VALIDATED",
  "APPROVED",
  "ACTIVE",
]

export const HEALTH_LABELS: Record<ProviderHealthStatus, string> = {
  UNKNOWN: "Não verificado",
  HEALTHY: "Saudável",
  UNHEALTHY: "Com falha",
}

/** Erro de API com o status HTTP, para o contexto tratar 409 (revisão desatualizada). */
export class PaymentProvidersApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "PaymentProvidersApiError"
    this.status = status
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}
