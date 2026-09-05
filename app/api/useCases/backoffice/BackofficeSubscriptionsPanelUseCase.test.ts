import { describe, expect, it, mock } from "bun:test"
import { BackofficeSubscriptionsPanelUseCase, computePanelSummary } from "./BackofficeSubscriptionsPanelUseCase"
import type { PanelSubscriptionRecord } from "@/app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/IBackofficeSubscriptionsPanelRepository"

const NOW = new Date("2026-09-01T12:00:00.000Z")

function record(overrides: Partial<PanelSubscriptionRecord> = {}): PanelSubscriptionRecord {
  return {
    profileId: "profile-1",
    hasPermanentSubscription: false,
    subscriptionStatus: "active",
    cycle: "monthly",
    chargedAmount: 100,
    nextDueDate: null,
    subscriptionEndDate: null,
    productName: "CRM",
    asaasSubscriptionId: null,
    asaasSubscriptionAccount: "primary",
    ...overrides,
  }
}

describe("computePanelSummary — T-50.10", () => {
  it("MRR normalizado por ciclo (MONTHLY/QUARTERLY/YEARLY equivalentes)", () => {
    const summary = computePanelSummary(
      [
        record({ profileId: "m1", cycle: "monthly", chargedAmount: 100 }), // 100/mês
        record({ profileId: "m2", cycle: "quarterly", chargedAmount: 300 }), // 100/mês
        record({ profileId: "m3", cycle: "annual", chargedAmount: 1200 }), // 100/mês
      ],
      0,
      NOW
    )

    expect(summary.mrr).toBe(300)
  })

  it("vencimentos caem na janela certa (30/60/90)", () => {
    const day = 86_400_000
    const summary = computePanelSummary(
      [
        record({ profileId: "m1", nextDueDate: new Date(NOW.getTime() + 10 * day) }),
        record({ profileId: "m2", nextDueDate: new Date(NOW.getTime() + 45 * day) }),
        record({ profileId: "m3", nextDueDate: new Date(NOW.getTime() + 75 * day) }),
        record({ profileId: "m4", nextDueDate: new Date(NOW.getTime() + 120 * day) }),
      ],
      0,
      NOW
    )

    expect(summary.dueWindows).toEqual({ d30: 1, d60: 1, d90: 1 })
  })

  it("permanentes contados à parte, nunca somados ao MRR", () => {
    const summary = computePanelSummary(
      [
        record({ profileId: "m1", hasPermanentSubscription: true, chargedAmount: null, cycle: null }),
        record({ profileId: "m2", cycle: "monthly", chargedAmount: 100 }),
      ],
      0,
      NOW
    )

    expect(summary.permanentCount).toBe(1)
    expect(summary.mrr).toBe(100)
  })
})

describe("BackofficeSubscriptionsPanelUseCase.getSummary — T-50.11", () => {
  function makeRepository(records: PanelSubscriptionRecord[], memberProExternalCount = 0) {
    return {
      findActiveMastersForPanel: mock(async () => records),
      countMemberProExternalAdhesions: mock(async () => memberProExternalCount),
    }
  }

  it("enriquecimento Asaas indisponível → partial: true, métricas locais íntegras, asaasEnrichment null", async () => {
    const repository = makeRepository([record({ chargedAmount: 100, cycle: "monthly" })])
    const enricher = { enrich: mock(async () => { throw new Error("Asaas fora do ar") }) }

    const useCase = new BackofficeSubscriptionsPanelUseCase(repository, enricher)
    const output = await useCase.getSummary(NOW)

    expect(output.isValid).toBe(true)
    const result = output.result as { partial: boolean; mrr: number; asaasEnrichment: unknown }
    expect(result.partial).toBe(true)
    expect(result.mrr).toBe(100)
    expect(result.asaasEnrichment).toBeNull()
  })

  it("enriquecimento Asaas disponível → partial: false, asaasEnrichment populado", async () => {
    const repository = makeRepository([record({ chargedAmount: 100, cycle: "monthly" })])
    const enricher = { enrich: mock(async () => ({ sampledCount: 1, mismatchCount: 0 })) }

    const useCase = new BackofficeSubscriptionsPanelUseCase(repository, enricher)
    const output = await useCase.getSummary(NOW)

    const result = output.result as { partial: boolean; asaasEnrichment: { sampledCount: number; mismatchCount: number } }
    expect(result.partial).toBe(false)
    expect(result.asaasEnrichment).toEqual({ sampledCount: 1, mismatchCount: 0 })
  })
})
