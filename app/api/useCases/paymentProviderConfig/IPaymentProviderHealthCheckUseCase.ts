import type { Output } from "@/lib/output"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type PaymentProviderHealthCheckActor = {
  readonly profileId: string
  readonly backofficeUserId: string | null
}

/** `id` da instância; o par `provider` + `environment` é o corpo antigo (instância única). */
export type PaymentProviderHealthCheckInput = {
  readonly id?: string
  readonly provider?: PaymentProviderKey
  readonly environment?: PaymentProviderEnvironment
  readonly actor: PaymentProviderHealthCheckActor
}

export interface IPaymentProviderHealthCheckUseCase {
  check(input: PaymentProviderHealthCheckInput): Promise<Output>
}
