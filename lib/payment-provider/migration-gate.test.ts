import { describe, expect, it } from "bun:test"
import { isMigrationGateActive, type PaymentProviderMigrationGate } from "./migration-gate"

const activeGate: PaymentProviderMigrationGate = {
  sourceRoute: "LEGACY_ASAAS",
  targetRoute: "NEW_ROUTER",
  version: "gate-v1",
  environment: "PRODUCTION",
  externalAccountContext: "primary",
  status: "ACTIVE",
  expiresAt: new Date("2026-10-20T12:00:00.000Z"),
}

describe("payment provider migration gate", () => {
  it("exige status ativo, validade e binding exato", () => {
    expect(
      isMigrationGateActive(activeGate, {
        version: "gate-v1",
        now: new Date("2026-10-20T11:00:00.000Z"),
        sourceRoute: "LEGACY_ASAAS",
        targetRoute: "NEW_ROUTER",
        environment: "PRODUCTION",
        externalAccountContext: "primary",
      }),
    ).toBe(true)
  })

  it("falha fechado quando expira ou o contexto diverge", () => {
    expect(
      isMigrationGateActive(activeGate, {
        version: "gate-v1",
        now: new Date("2026-10-20T12:00:00.000Z"),
        sourceRoute: "LEGACY_ASAAS",
        targetRoute: "NEW_ROUTER",
        environment: "PRODUCTION",
        externalAccountContext: "legacy",
      }),
    ).toBe(false)
  })

  it("falha fechado quando a versão do gate diverge", () => {
    expect(
      isMigrationGateActive(activeGate, {
        version: "gate-v2",
        now: new Date("2026-10-20T11:00:00.000Z"),
        sourceRoute: "LEGACY_ASAAS",
        targetRoute: "NEW_ROUTER",
        environment: "PRODUCTION",
        externalAccountContext: "primary",
      }),
    ).toBe(false)
  })

  it("não aceita gate com source e target iguais", () => {
    expect(() =>
      isMigrationGateActive(
        { ...activeGate, targetRoute: "LEGACY_ASAAS" },
        {
          version: "gate-v1",
          now: new Date("2026-10-20T11:00:00.000Z"),
          sourceRoute: "LEGACY_ASAAS",
          targetRoute: "LEGACY_ASAAS",
          environment: "PRODUCTION",
          externalAccountContext: "primary",
        },
      ),
    ).toThrow("rotas")
  })
})
