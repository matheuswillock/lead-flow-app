import type { Output } from "@/lib/output"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type PaymentProviderHealthCheckActor = {
  readonly profileId: string
  readonly backofficeUserId: string | null
}

export type PaymentProviderHealthCheckInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly actor: PaymentProviderHealthCheckActor
}

export interface IPaymentProviderHealthCheckUseCase {
  check(input: PaymentProviderHealthCheckInput): Promise<Output>
}
