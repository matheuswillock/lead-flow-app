import type { Output } from "@/lib/output"
import type {
  ProviderRoutingConfigPatch,
  ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type PaymentProviderConfigActor = {
  readonly profileId: string
  readonly backofficeUserId: string | null
}

export type PaymentProviderConfigUseCaseInput = {
  readonly environment: PaymentProviderEnvironment
  readonly provider?: PaymentProviderKey
  readonly patch?: ProviderRoutingConfigPatch
  readonly actor?: PaymentProviderConfigActor
}

export interface IPaymentProviderConfigUseCase {
  list(input: PaymentProviderConfigUseCaseInput): Promise<Output>
  update(
    input: PaymentProviderConfigUseCaseInput & {
      readonly provider: PaymentProviderKey
      readonly patch: ProviderRoutingConfigPatch
    },
  ): Promise<Output>
}

export type SafeProviderRoutingConfig = Omit<ProviderRoutingConfigRecord, "healthStatus"> & {
  readonly healthStatus: ProviderRoutingConfigRecord["healthStatus"]
}
