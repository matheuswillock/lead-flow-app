import { describe, expect, it } from "bun:test"
import {
  ProviderRoutingConfigError,
  applyProviderRoutingConfigPatch,
  type ProviderRoutingConfigRecord,
} from "./routing-config"

const existing: ProviderRoutingConfigRecord = {
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  enabled: false,
  isDefault: true,
  externalAccountContext: "abacate-production",
  rolloutState: "DISABLED",
  killSwitch: false,
  revision: 1,
  healthStatus: "UNKNOWN",
}

describe("provider routing config", () => {
  it("aplica uma revisão sem receber secrets ou capability do cliente", () => {
    const next = applyProviderRoutingConfigPatch(existing, {
      enabled: true,
      rolloutState: "SANDBOX_VALIDATED",
      expectedRevision: 1,
    })

    expect(next).toMatchObject({ enabled: true, rolloutState: "SANDBOX_VALIDATED", revision: 2 })
    expect("apiKey" in next).toBe(false)
    expect("capabilities" in next).toBe(false)
  })

  it("impede ativar produção sem aprovação sandbox", () => {
    expect(() =>
      applyProviderRoutingConfigPatch(existing, {
        enabled: true,
        rolloutState: "ACTIVE",
        expectedRevision: 1,
      }),
    ).toThrowError(
      new ProviderRoutingConfigError(
        "ROLLOUT_INVALID",
        "Produção exige validação e aprovação antes de ACTIVE",
      ),
    )
  })

  it("não permite pular SANDBOX_VALIDATED ao aprovar", () => {
    expect(() =>
      applyProviderRoutingConfigPatch(existing, {
        rolloutState: "APPROVED",
        expectedRevision: 1,
      }),
    ).toThrow("deve avançar")
  })

  it("desativa e invalida a saúde ao trocar a conta externa", () => {
    const next = applyProviderRoutingConfigPatch(
      { ...existing, rolloutState: "ACTIVE", enabled: true, healthStatus: "HEALTHY" },
      { externalAccountContext: "abacate-production-new", expectedRevision: 1 },
    )

    expect(next).toMatchObject({
      enabled: false,
      rolloutState: "DISABLED",
      healthStatus: "UNKNOWN",
    })
  })

  it("impede ativação com kill switch", () => {
    expect(() =>
      applyProviderRoutingConfigPatch(
        { ...existing, rolloutState: "APPROVED" },
        {
          enabled: true,
          rolloutState: "ACTIVE",
          killSwitch: true,
          expectedRevision: 1,
        },
      ),
    ).toThrow("kill switch")
  })

  it("permite acionar o kill switch de um provider ativo", () => {
    const next = applyProviderRoutingConfigPatch(
      { ...existing, enabled: true, rolloutState: "ACTIVE" },
      { killSwitch: true, expectedRevision: 1 },
    )

    expect(next).toMatchObject({
      enabled: true,
      rolloutState: "ACTIVE",
      killSwitch: true,
      revision: 2,
    })
  })

  it("falha em revisão concorrente", () => {
    expect(() => applyProviderRoutingConfigPatch(existing, { expectedRevision: 2 })).toThrow(
      "revisão",
    )
  })
})
