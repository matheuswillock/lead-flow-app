import { describe, expect, it, mock } from "bun:test"

/**
 * Uma resposta de `analytics`, um relógio só.
 *
 * Regressão do achado do #1060: os agregados em SQL passaram a cortar o período
 * por `COALESCE(occurredAt, createdAt)` e os dois consumidores em Prisma
 * (`countDiscardedLeadsByReason`, `listFormViewOrigins`) continuaram em
 * `createdAt` puro. No cenário que o E3 existe para corrigir — aceite no dia A,
 * drain no dia B — o total de descartes contava em A e o breakdown por motivo em
 * B: a tela exibia total ≠ soma dos motivos no mesmo período.
 */

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const countDiscardedLeadsByReason = mock(async (_id: string, _where: unknown) => [])
const listFormViewOrigins = mock(async (_where: unknown) => [])

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findAnalyticsPublications: mock(async () => [
      { id: "pub-1", version: 1, publishedAt: new Date(), endedAt: null, snapshot: { questions: [] } },
    ]),
    groupMetricEvents: mock(async () => []),
    countDistinctSessionsByEventType: mock(async () => ({})),
    countDistinctCompletedLeads: mock(async () => 0),
    countDiscardedLeadsByReason,
    listFormViewOrigins,
  },
}))
mock.module("@/app/api/infra/data/repositories/publicFormJourney/PublicFormJourneyRepository", () => ({
  publicFormJourneyRepository: { countJourneyStates: mock(async () => ({})) },
}))
mock.module("@/app/api/useCases/radar/syncPublicFormMetricToRadarInline", () => ({
  syncPublicFormMetricToRadarInline: mock(async () => {}),
}))
mock.module("@/app/api/useCases/radar/syncPublicFormMetricToRadarFactory", () => ({
  syncPublicFormMetricToRadarUseCase: {},
}))
mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: { execute: mock(async () => ({ isValid: true, result: null })) },
}))

const { publicFormsService } = await import("./PublicFormsService")

type PeriodWhere = {
  OR?: Array<{ occurredAt?: unknown; createdAt?: unknown }>
  createdAt?: unknown
}

const from = new Date("2026-08-20T00:00:00.000Z")
const to = new Date("2026-08-21T00:00:00.000Z")

describe("PublicFormsService.analytics — âncora única na resposta", () => {
  it("descartes e origens cortam pelo mesmo relógio dos agregados em SQL", async () => {
    countDiscardedLeadsByReason.mockClear()
    listFormViewOrigins.mockClear()

    await publicFormsService.analytics("team-1", FORM_ID, from, to)

    const discardWhere = (countDiscardedLeadsByReason.mock.calls[0] as unknown as [string, PeriodWhere])[1]
    const originsWhere = (listFormViewOrigins.mock.calls[0] as unknown as [PeriodWhere])[0]

    for (const where of [discardWhere, originsWhere]) {
      // `createdAt` sozinho no topo é justamente o bug: significa relógio do insert.
      expect(where.createdAt).toBeUndefined()
      expect(where.OR).toEqual([
        { occurredAt: { gte: from, lte: to } },
        { occurredAt: null, createdAt: { gte: from, lte: to } },
      ])
    }
  })

  it("sem período não impõe filtro de data nenhum", async () => {
    countDiscardedLeadsByReason.mockClear()

    await publicFormsService.analytics("team-1", FORM_ID)

    const where = (countDiscardedLeadsByReason.mock.calls[0] as unknown as [string, PeriodWhere])[1]
    expect(where.OR).toBeUndefined()
    expect(where.createdAt).toBeUndefined()
  })
})
