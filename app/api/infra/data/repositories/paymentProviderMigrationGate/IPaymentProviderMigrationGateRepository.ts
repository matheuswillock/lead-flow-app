import type { PaymentProviderMigrationGate } from "@/lib/payment-provider/migration-gate"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"
import type { PaymentProviderRoute } from "@/lib/payment-provider/identity"

export type FindActiveMigrationGateInput = {
  readonly version: string
  readonly sourceRoute: PaymentProviderRoute
  readonly targetRoute: PaymentProviderRoute
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly now: Date
}

export type CreateMigrationGateInput = Omit<PaymentProviderMigrationGate, "status"> & {
  readonly authorizedByProfileId: string
}

export type ActivateMigrationGateInput = {
  readonly id: string
  readonly authorizedByProfileId: string
  readonly now: Date
}

export type RevokeMigrationGateInput = ActivateMigrationGateInput

export interface IPaymentProviderMigrationGateRepository {
  findActive(input: FindActiveMigrationGateInput): Promise<PaymentProviderMigrationGate | null>
  create(input: CreateMigrationGateInput): Promise<PaymentProviderMigrationGate>
  activate(input: ActivateMigrationGateInput): Promise<PaymentProviderMigrationGate>
  revoke(input: RevokeMigrationGateInput): Promise<PaymentProviderMigrationGate>
}
