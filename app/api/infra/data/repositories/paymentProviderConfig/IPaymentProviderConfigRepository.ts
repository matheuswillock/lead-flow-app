import type { ProviderInstanceRecord, StoredProviderSettings } from "@/lib/payment-provider/instance"
import type { ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type CreateProviderInstanceInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly displayName: string
  readonly logoUrl: string | null
  readonly logoAltText: string | null
}

export type ProviderInstanceMetadataPatch = {
  readonly displayName?: string
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
  readonly settings?: StoredProviderSettings
}

export type UpdateProviderInstanceInput = {
  readonly id: string
  readonly patch: ProviderRoutingConfigPatch
  readonly metadata?: ProviderInstanceMetadataPatch
  /** Regra de domínio extra aplicada ao registro já calculado, dentro da transação. */
  readonly assertNext?: (next: ProviderInstanceRecord) => void
}

export type RecordProviderHealthCheckInput = {
  readonly id: string
  /** Null mantém o status atual (primeira falha de uma sequência). */
  readonly healthStatus: "HEALTHY" | "UNHEALTHY" | null
  readonly checkedAt: Date
  readonly errorCode: string | null
  readonly errorMessage: string | null
}

export interface IPaymentProviderConfigRepository {
  list(environment: PaymentProviderEnvironment): Promise<readonly ProviderInstanceRecord[]>
  listAll(): Promise<readonly ProviderInstanceRecord[]>
  findById(id: string): Promise<ProviderInstanceRecord | null>
  /** Instância usada para resolver credenciais: padrão, depois habilitada, depois a mais antiga. */
  findPrimary(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): Promise<ProviderInstanceRecord | null>
  findByScope(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
    externalAccountContext: string,
  ): Promise<ProviderInstanceRecord | null>
  create(input: CreateProviderInstanceInput): Promise<ProviderInstanceRecord>
  update(input: UpdateProviderInstanceInput): Promise<ProviderInstanceRecord>
  /** Grava o resultado da sondagem sem alterar configRevision nem o roteamento. */
  recordHealthCheck(input: RecordProviderHealthCheckInput): Promise<ProviderInstanceRecord>
}
