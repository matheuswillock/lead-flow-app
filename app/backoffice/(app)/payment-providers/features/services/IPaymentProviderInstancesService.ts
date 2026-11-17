export type PaymentProviderInstance = {
  id: string
  provider: "ASAAS" | "ABACATE_PAY"
  environment: "DEV" | "PRODUCTION"
  displayName: string | null
  logoUrl: string | null
  logoAltText: string | null
  externalAccountContext: string
  enabled: boolean
  rolloutState: string
  isDefault: boolean
  healthStatus: string
  lastHealthCheckAt: string | null
  isSelectable: boolean
  capabilities: string[]
  credentials: Record<string, { isSet: boolean; last4: string | null; fingerprint: string | null }>
}

export type CreatePaymentProviderInstance = {
  provider: PaymentProviderInstance["provider"]
  environment: PaymentProviderInstance["environment"]
  displayName: string
  logoUrl?: string | null
  logoAltText?: string | null
  externalAccountContext: string
  isDefault: boolean
  credentials: Record<string, string>
}

export interface IPaymentProviderInstancesService {
  list(): Promise<PaymentProviderInstance[]>
  create(input: CreatePaymentProviderInstance): Promise<PaymentProviderInstance>
  update(input: {
    id: string
    isDefault?: boolean
    credentials?: Record<string, string>
    displayName?: string
    logoUrl?: string | null
    logoAltText?: string | null
  }): Promise<PaymentProviderInstance>
  checkHealth(provider: PaymentProviderInstance["provider"], environment: PaymentProviderInstance["environment"]): Promise<void>
}
