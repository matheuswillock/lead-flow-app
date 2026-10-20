import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type CheckPaymentProviderHealthInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
}

export interface IPaymentProviderHealthCheckService {
  check(input: CheckPaymentProviderHealthInput): Promise<ProviderRoutingConfigRecord>
}
