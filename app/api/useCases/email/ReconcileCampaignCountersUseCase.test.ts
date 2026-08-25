import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  CampaignCounters,
  CounterFix,
  CounterSnapshot,
  DispatchCounters,
} from "@/lib/email/campaign-counter-reconciliation"
import {
  ReconcileCampaignCountersUseCase,
  type ICampaignCounterReconciliationRepository,
} from "./ReconcileCampaignCountersUseCase"

function campaignCounters(overrides: Partial<CampaignCounters> = {}): CampaignCounters {
  return {
    totalRecipients: 100,
    totalSent: 100,
    totalDelivered: 90,
    totalOpened: 40,
    totalClicked: 10,
    totalBounced: 5,
    totalComplained: 1,
    ...overrides,
  }
}

function dispatchCounters(overrides: Partial<DispatchCounters> = {}): DispatchCounters {
  return {
    totalSent: 100,
    totalDelivered: 90,
    totalOpened: 40,
    totalClicked: 10,
    totalBounced: 5,
    totalComplained: 1,
    ...overrides,
  }
}

type QueryOptions = { limit: number; inFlightWatermark: Date }

const findCampaignSnapshots = mock(
  async (_options: QueryOptions): Promise<CounterSnapshot<CampaignCounters>[]> => []
)
const findDispatchSnapshots = mock(
  async (_options: QueryOptions): Promise<CounterSnapshot<DispatchCounters>[]> => []
)
const applyCampaignFixes = mock(async (_fixes: CounterFix<CampaignCounters>[]) => {})
const applyDispatchFixes = mock(async (_fixes: CounterFix<DispatchCounters>[]) => {})

function buildRepository(): ICampaignCounterReconciliationRepository {
  return {
    findCampaignCounterSnapshots: findCampaignSnapshots,
    findDispatchCounterSnapshots: findDispatchSnapshots,
    applyCampaignCounterFixes: applyCampaignFixes,
    applyDispatchCounterFixes: applyDispatchFixes,
  } as unknown as ICampaignCounterReconciliationRepository
}

describe("ReconcileCampaignCountersUseCase", () => {
  beforeEach(() => {
    findCampaignSnapshots.mockClear()
    findDispatchSnapshots.mockClear()
    applyCampaignFixes.mockClear()
    applyDispatchFixes.mockClear()
    findCampaignSnapshots.mockImplementation(async () => [])
    findDispatchSnapshots.mockImplementation(async () => [])
  })

  /**
   * T-C1.1 — o caso medido na auditoria: `totalSent` mente, o resto dos
   * contadores bate 1:1 com os logs.
   */
  it("T-C1.1 — corrige o drift de totalSent e mantém delivered no valor que já batia", async () => {
    findCampaignSnapshots.mockImplementation(async () => [
      {
        id: "campanha-1",
        current: campaignCounters({ totalSent: 5_031, totalDelivered: 8_436 }),
        computed: campaignCounters({ totalSent: 8_512, totalDelivered: 8_436 }),
      },
    ])

    const output = await new ReconcileCampaignCountersUseCase(buildRepository()).execute()

    expect(output.isValid).toBe(true)
    expect(applyCampaignFixes).toHaveBeenCalledTimes(1)

    const fixes = applyCampaignFixes.mock.calls[0]?.[0] as CounterFix<CampaignCounters>[]
    expect(fixes).toHaveLength(1)
    expect(fixes[0]?.id).toBe("campanha-1")
    expect(fixes[0]?.counters.totalSent).toBe(8_512)
    expect(fixes[0]?.counters.totalDelivered).toBe(8_436)
    expect(fixes[0]?.delta).toBe(3_481)

    const summary = output.result as { campaignsFixed: number; campaignDelta: number }
    expect(summary.campaignsFixed).toBe(1)
    expect(summary.campaignDelta).toBe(3_481)
  })

  /** T-C1.1 (contra-prova) — linha sem divergência não é escrita. */
  it("T-C1.1b — campanha cujo cache já bate com os logs não é atualizada", async () => {
    findCampaignSnapshots.mockImplementation(async () => [
      { id: "campanha-ok", current: campaignCounters(), computed: campaignCounters() },
    ])

    const output = await new ReconcileCampaignCountersUseCase(buildRepository()).execute()

    expect(applyCampaignFixes).not.toHaveBeenCalled()
    expect((output.result as { campaignsFixed: number }).campaignsFixed).toBe(0)
  })

  /** T-C1.2 — SUM(dispatch) ≠ campanha: os dois níveis são corrigidos. */
  it("T-C1.2 — corrige campanha e disparo no mesmo passe, somando o delta de cada nível", async () => {
    findCampaignSnapshots.mockImplementation(async () => [
      {
        id: "campanha-1",
        current: campaignCounters({ totalSent: 200 }),
        computed: campaignCounters({ totalSent: 260 }),
      },
    ])
    findDispatchSnapshots.mockImplementation(async () => [
      {
        id: "disparo-1",
        current: dispatchCounters({ totalSent: 100 }),
        computed: dispatchCounters({ totalSent: 130 }),
      },
      {
        id: "disparo-2",
        current: dispatchCounters({ totalSent: 100, totalOpened: 40 }),
        computed: dispatchCounters({ totalSent: 130, totalOpened: 41 }),
      },
    ])

    const output = await new ReconcileCampaignCountersUseCase(buildRepository()).execute()

    expect(applyCampaignFixes).toHaveBeenCalledTimes(1)
    expect(applyDispatchFixes).toHaveBeenCalledTimes(1)

    const dispatchFixes = applyDispatchFixes.mock.calls[0]?.[0] as CounterFix<DispatchCounters>[]
    expect(dispatchFixes.map((fix) => fix.id)).toEqual(["disparo-1", "disparo-2"])

    const summary = output.result as {
      campaignsFixed: number
      campaignDelta: number
      dispatchesFixed: number
      dispatchDelta: number
    }
    expect(summary.campaignsFixed).toBe(1)
    expect(summary.campaignDelta).toBe(60)
    expect(summary.dispatchesFixed).toBe(2)
    expect(summary.dispatchDelta).toBe(61)
  })

  /**
   * T-C1.1 (guarda de corrida) — a reconciliação nunca pode pedir linhas de
   * disparo em voo: o webhook está incrementando o mesmo contador. O watermark
   * de 1h é o contrato com o repositório.
   */
  it("T-C1.1c — pede ao repositório apenas linhas fora da janela de 1h de disparo ativo", async () => {
    const antes = Date.now()
    await new ReconcileCampaignCountersUseCase(buildRepository()).execute()
    const depois = Date.now()

    const campaignOptions = findCampaignSnapshots.mock.calls[0][0]
    const dispatchOptions = findDispatchSnapshots.mock.calls[0][0]

    const umaHoraMs = 60 * 60 * 1000
    expect(campaignOptions.inFlightWatermark.getTime()).toBeGreaterThanOrEqual(antes - umaHoraMs)
    expect(campaignOptions.inFlightWatermark.getTime()).toBeLessThanOrEqual(depois - umaHoraMs)
    expect(dispatchOptions.inFlightWatermark.getTime()).toBe(
      campaignOptions.inFlightWatermark.getTime()
    )
    expect(campaignOptions.limit).toBeGreaterThan(0)
  })

  /** Teto de lote não pode virar cobertura silenciosa: a execução avisa. */
  it("T-C1.1d — lote cheio marca truncated no resumo", async () => {
    const useCase = new ReconcileCampaignCountersUseCase(buildRepository(), { batchSize: 2 })
    findCampaignSnapshots.mockImplementation(async () => [
      {
        id: "campanha-1",
        current: campaignCounters({ totalSent: 1 }),
        computed: campaignCounters({ totalSent: 2 }),
      },
      {
        id: "campanha-2",
        current: campaignCounters({ totalSent: 1 }),
        computed: campaignCounters({ totalSent: 2 }),
      },
    ])

    const output = await useCase.execute()

    expect((output.result as { truncated: boolean }).truncated).toBe(true)
  })
})
