import type { Output } from "@/lib/output"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"

export type CreateProviderInstanceCommand = {
  readonly provider: "ASAAS" | "ABACATE_PAY"
  readonly environment: PaymentProviderEnvironment
  readonly displayName: string
  readonly externalAccountContext: string
  readonly isDefault: boolean
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
  readonly credentials: Readonly<Record<string, string>>
  readonly actorProfileId: string
}

export type UpdateProviderInstanceCommand = {
  readonly id: string
  readonly displayName?: string
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
  readonly isDefault?: boolean
  readonly credentials: Readonly<Record<string, string>>
  readonly actorProfileId: string
}

export interface IPaymentProviderInstancesUseCase {
  list(environment?: PaymentProviderEnvironment): Promise<Output>
  create(input: CreateProviderInstanceCommand): Promise<Output>
  update(input: UpdateProviderInstanceCommand): Promise<Output>
}
