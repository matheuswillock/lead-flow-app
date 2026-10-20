import type { PaymentProviderEnvironment } from "./types"
import type { PaymentProviderRoute } from "./identity"

export type PaymentProviderMigrationGateStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED"

export type PaymentProviderMigrationGate = {
  readonly id?: string
  readonly sourceRoute: PaymentProviderRoute
  readonly targetRoute: PaymentProviderRoute
  readonly version: string
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly status: PaymentProviderMigrationGateStatus
  readonly expiresAt: Date
}

export type MigrationGateValidationInput = {
  readonly version: string
  readonly now: Date
  readonly sourceRoute: PaymentProviderRoute
  readonly targetRoute: PaymentProviderRoute
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
}

export function isMigrationGateActive(
  gate: PaymentProviderMigrationGate,
  input: MigrationGateValidationInput,
): boolean {
  if (gate.sourceRoute === gate.targetRoute) {
    throw new Error("Gate de migração exige rotas diferentes")
  }
  return (
    gate.status === "ACTIVE" &&
    gate.version === input.version &&
    gate.expiresAt.getTime() > input.now.getTime() &&
    gate.sourceRoute === input.sourceRoute &&
    gate.targetRoute === input.targetRoute &&
    gate.environment === input.environment &&
    gate.externalAccountContext === input.externalAccountContext
  )
}
