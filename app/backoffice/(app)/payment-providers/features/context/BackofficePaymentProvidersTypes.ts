export type PaymentProviderKey = "ASAAS" | "ABACATE_PAY"
export type PaymentProviderEnvironment = "DEV" | "PRODUCTION"
export type ProviderRolloutState = "DISABLED" | "SANDBOX_VALIDATED" | "APPROVED" | "ACTIVE"
export type ProviderHealthStatus = "UNKNOWN" | "HEALTHY" | "UNHEALTHY"

export interface ProviderCredentialView {
  key: string
  isSet: boolean
  last4: string | null
  fingerprint: string | null
  required: boolean
  updatedAt: string | null
}

export interface ProviderInstanceSettings {
  requireSignature: boolean
  cardEnabled: boolean
}

export interface ProviderInstanceView {
  id: string
  providerKey: PaymentProviderKey
  environment: PaymentProviderEnvironment
  externalAccountContext: string
  displayName: string
  logoUrl: string | null
  logoAltText: string | null
  enabled: boolean
  isDefault: boolean
  rolloutState: ProviderRolloutState
  killSwitch: boolean
  configRevision: number
  healthStatus: ProviderHealthStatus
  lastHealthCheckAt: string | null
  lastErrorCode: string | null
  paymentCapable: boolean
  credentials: ProviderCredentialView[]
  settings: ProviderInstanceSettings
}

export interface ProviderAdapterCredentialField {
  key: string
  label: string
  required: boolean
  secret: boolean
  hint: string | null
}

export interface ProviderAdapterView {
  providerKey: PaymentProviderKey
  label: string
  paymentCapable: boolean
  credentialSchema: ProviderAdapterCredentialField[]
}

export interface ProviderHistoryItem {
  at: string
  actor: string
  operation: string
  summary: string
}

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
  settings?: Partial<ProviderInstanceSettings>
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
