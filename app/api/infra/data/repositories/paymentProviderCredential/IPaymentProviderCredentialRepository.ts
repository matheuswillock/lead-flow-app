import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type ProviderCredentialSummary = {
  readonly isSet: true
  readonly last4: string | null
  readonly fingerprint: string
}

export type PaymentProviderInstanceRecord = {
  readonly id: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly displayName: string | null
  readonly externalAccountContext: string
  readonly enabled: boolean
  readonly rolloutState: string
  readonly isDefault: boolean
  readonly healthStatus: string
  readonly lastHealthCheckAt: Date | null
  readonly logoUrl: string | null
  readonly logoAltText: string | null
  readonly credentials: Readonly<Record<string, ProviderCredentialSummary>>
}

export type CreatePaymentProviderInstanceInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly displayName: string
  readonly externalAccountContext: string
  readonly isDefault: boolean
  readonly logoUrl: string | null
  readonly logoAltText: string | null
  readonly credentials: Readonly<Record<string, string>>
  readonly actorProfileId: string
}

export type UpdatePaymentProviderInstanceInput = {
  readonly id: string
  readonly displayName?: string
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
  readonly isDefault?: boolean
  readonly credentials: Readonly<Record<string, string>>
  readonly actorProfileId: string
}

export interface IPaymentProviderCredentialRepository {
  list(environment?: PaymentProviderEnvironment): Promise<readonly PaymentProviderInstanceRecord[]>
  create(input: CreatePaymentProviderInstanceInput): Promise<PaymentProviderInstanceRecord>
  update(input: UpdatePaymentProviderInstanceInput): Promise<PaymentProviderInstanceRecord>
  findById(id: string): Promise<PaymentProviderInstanceRecord | null>
  getEncrypted(input: {
    provider: PaymentProviderKey
    environment: PaymentProviderEnvironment
    externalAccountContext: string
    key: string
  }): Promise<{ readonly keyId: string; readonly valueCiphertext: string } | null>
}
