import type {
  ProviderRoutingConfigPatch,
  ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type UpdateProviderRoutingConfigInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly patch: ProviderRoutingConfigPatch
}

export type RecordProviderHealthCheckInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly healthStatus: "HEALTHY" | "UNHEALTHY"
  readonly checkedAt: Date
  readonly errorCode: string | null
  readonly errorMessage: string | null
}

export interface IPaymentProviderConfigRepository {
  /** Grava o resultado da sondagem sem alterar configRevision nem o roteamento. */
  recordHealthCheck(input: RecordProviderHealthCheckInput): Promise<ProviderRoutingConfigRecord>
  list(environment: PaymentProviderEnvironment): Promise<readonly ProviderRoutingConfigRecord[]>
  update(input: UpdateProviderRoutingConfigInput): Promise<ProviderRoutingConfigRecord>
}
