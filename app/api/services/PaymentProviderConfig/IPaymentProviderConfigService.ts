import type {
  ProviderRoutingConfigPatch,
  ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type UpdatePaymentProviderConfigServiceInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly patch: ProviderRoutingConfigPatch
}

export interface IPaymentProviderConfigService {
  list(environment: PaymentProviderEnvironment): Promise<readonly ProviderRoutingConfigRecord[]>
  update(input: UpdatePaymentProviderConfigServiceInput): Promise<ProviderRoutingConfigRecord>
}
