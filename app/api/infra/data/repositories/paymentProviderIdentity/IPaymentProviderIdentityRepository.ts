import type {
  PaymentProviderIdentityType,
  ProviderIdentityBinding,
} from "@/lib/payment-provider/identity"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type ProviderIdentityRecord = ProviderIdentityBinding & {
  readonly id: string
  readonly bindingRevision: number
}

export type ProviderIdentityLookup = {
  readonly tenantId: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly identityType: PaymentProviderIdentityType
  readonly externalId?: string
  readonly ownerType?: string
  readonly ownerId?: string
}

export interface IPaymentProviderIdentityRepository {
  bind(binding: ProviderIdentityBinding): Promise<ProviderIdentityRecord>
  find(input: ProviderIdentityLookup): Promise<ProviderIdentityRecord | null>
}
