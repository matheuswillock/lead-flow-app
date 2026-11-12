import type {
  CreatePaymentProviderInstance,
  PaymentProviderInstance,
} from "../services/IPaymentProviderInstancesService"

export type PaymentProviderInstancesContextValue = {
  instances: PaymentProviderInstance[]
  loading: boolean
  saving: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (input: CreatePaymentProviderInstance) => Promise<void>
  update: (input: {
    id: string
    isDefault?: boolean
    credentials?: Record<string, string>
    displayName?: string
    logoUrl?: string | null
    logoAltText?: string | null
  }) => Promise<void>
  checkHealth: (
    provider: PaymentProviderInstance["provider"],
    environment: PaymentProviderInstance["environment"],
  ) => Promise<void>
}
