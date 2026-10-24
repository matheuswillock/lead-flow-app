import type { ProviderInstanceRecord } from "@/lib/payment-provider/instance"

export type HealthCheckMode = "manual" | "scheduled"

export type DegradedInstance = {
  readonly id: string
  readonly displayName: string
  readonly provider: string
  readonly environment: string
  readonly errorCode: string | null
}

export type HealthCheckSweepSummary = {
  readonly checked: number
  readonly healthy: number
  readonly failing: number
  /** Instâncias que ficaram UNHEALTHY neste ciclo (segunda falha seguida). */
  readonly degraded: readonly DegradedInstance[]
}

export interface IPaymentProviderHealthCheckService {
  check(input: { readonly id: string; readonly mode?: HealthCheckMode }): Promise<ProviderInstanceRecord>
  checkAll(): Promise<HealthCheckSweepSummary>
}
