import { describe, expect, it } from "bun:test"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import { selectWebhookAuthenticatableConfigurations } from "./selectWebhookAuthenticatableConfigurations"

function config(overrides: Partial<ProviderRoutingConfigRecord>): ProviderRoutingConfigRecord {
  return {
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: true,
    isDefault: false,
    externalAccountContext: "abacate-production",
    rolloutState: "ACTIVE",
    killSwitch: false,
    cardEnabled: false,
    revision: 1,
    healthStatus: "HEALTHY",
    ...overrides,
  }
}

describe("selectWebhookAuthenticatableConfigurations", () => {
  it("mantém a instância habilitada, ativa e sem kill switch", () => {
    const active = config({ externalAccountContext: "abacate-production" })
    expect(selectWebhookAuthenticatableConfigurations([active])).toEqual([active])
  })

  it("exclui instância desabilitada: um webhook forjado não pode se autenticar contra ela", () => {
    const disabled = config({ enabled: false })
    expect(selectWebhookAuthenticatableConfigurations([disabled])).toEqual([])
  })

  it("exclui instância com kill switch ligado", () => {
    const killed = config({ killSwitch: true })
    expect(selectWebhookAuthenticatableConfigurations([killed])).toEqual([])
  })

  it("exclui instância com rolloutState DISABLED", () => {
    const disabledRollout = config({ rolloutState: "DISABLED" })
    expect(selectWebhookAuthenticatableConfigurations([disabledRollout])).toEqual([])
  })

  it("mantém só as instâncias elegíveis entre várias", () => {
    const eligible = config({ externalAccountContext: "abacate-production" })
    const ineligible = config({ externalAccountContext: "abacate-legacy", killSwitch: true })
    expect(selectWebhookAuthenticatableConfigurations([eligible, ineligible])).toEqual([eligible])
  })
})
