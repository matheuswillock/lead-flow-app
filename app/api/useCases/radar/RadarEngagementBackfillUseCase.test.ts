import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { BackofficeCronExecution } from "@prisma/client"
import { RadarEngagementBackfillUseCase } from "./RadarEngagementBackfillUseCase"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"

import type { IRadarEngagementBackfillRepository } from "@/app/api/infra/data/repositories/radar/IRadarEngagementBackfillRepository"

/**
 * Tabela de perfis em memória, com a semântica que o cursor depende: ordenação
 * por id e filtro `id > cursor`.
 */
function makeFakeRepo(total: number, msPerBatch = 0) {
  const rows = Array.from({ length: total }, (_, index) => ({
    id: `p${String(index).padStart(5, "0")}`,
    teamId: "team-1",
    scored: false,
  }))

  const state = {
    rows,
    clock: 0,
    listCalls: [] as Array<{ cursorId: string | null; onlyMissingScore?: boolean }>,
    scoredOrder: [] as string[],
    batchSizes: [] as number[],
  }

  const repo = {
    async listProfilesForEngagementBackfill(params: {
      take: number
      cursorId?: string | null
      onlyMissingScore?: boolean
      activeSince?: Date | null
    }) {
      state.listCalls.push({
        cursorId: params.cursorId ?? null,
        onlyMissingScore: params.onlyMissingScore,
      })

      let visible = state.rows
      if (params.onlyMissingScore) visible = visible.filter((row) => !row.scored)
      if (params.cursorId) visible = visible.filter((row) => row.id > params.cursorId!)

      return visible.slice(0, params.take).map(({ id, teamId }) => ({ id, teamId }))
    },

    async updateEngagementScoresBatch(batch: Array<{ id: string; teamId: string }>) {
      state.clock += msPerBatch
      state.batchSizes.push(batch.length)
      for (const item of batch) {
        const row = state.rows.find((candidate) => candidate.id === item.id)
        if (row && !row.scored) {
          row.scored = true
          state.scoredOrder.push(row.id)
        }
      }
      return batch.length
    },

    async countProfilesMissingEngagementScore() {
      return state.rows.filter((row) => !row.scored).length
    },
  }

  return { repo: repo satisfies IRadarEngagementBackfillRepository, state }
}

/**
 * Fake do repositório de execuções de cron.
 *
 * O backfill só lê `findMany` (para achar o cursor da última execução
 * bem-sucedida); o resto existe para satisfazer a interface — inclusive
 * `findStaleRunningCandidates`/`claimStaleRunningAsFailed`, que são do watchdog
 * de execuções órfãs e não passam por este use case.
 */
function makeCronExecutions(
  lastSuccessMetadata?: unknown
): IBackofficeCronExecutionRepository {
  return {
    create: mock(async () => ({}) as BackofficeCronExecution),
    findMany: mock(async () =>
      lastSuccessMetadata === undefined
        ? []
        : [{ metadata: lastSuccessMetadata } as unknown as BackofficeCronExecution]
    ),
    markSuccess: mock(async () => ({}) as BackofficeCronExecution),
    markFailed: mock(async () => ({}) as BackofficeCronExecution),
    findStaleRunningCandidates: mock(async () => []),
    claimStaleRunningAsFailed: mock(async () => false),
  }
}

/** Nenhuma execução anterior legível: a varredura começa do zero. */
const noResumePoint = (): IBackofficeCronExecutionRepository => makeCronExecutions()

const originalBudget = process.env.RADAR_BACKFILL_TIME_BUDGET_MS

beforeEach(() => {
  process.env.RADAR_BACKFILL_TIME_BUDGET_MS = "240000"
})

afterEach(() => {
  if (originalBudget === undefined) delete process.env.RADAR_BACKFILL_TIME_BUDGET_MS
  else process.env.RADAR_BACKFILL_TIME_BUDGET_MS = originalBudget
})

describe("T-R2.1 — deadline corta o laço e persiste o cursor", () => {
  it("para no orçamento de tempo em vez de ser morto pela plataforma", async () => {
    // 100s por lote contra orçamento de 240s: o terceiro lote estoura.
    const { repo, state } = makeFakeRepo(5_000, 100_000)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    const output = await useCase.execute()
    const result = output.result as {
      timedOut: boolean
      processed: number
      cursorId: string | null
      phase: string
    }

    expect(output.isValid).toBe(true)
    expect(result.timedOut).toBe(true)
    expect(result.processed).toBeGreaterThan(0)
    // O cursor é o que a próxima execução vai consumir — sem ele, recomeça do zero.
    expect(result.cursorId).toBe(state.scoredOrder[state.scoredOrder.length - 1]!)
    expect(result.phase).toBe("pending_active")
  })

  it("devolve Output válido no corte parcial — não fica preso em running", async () => {
    const { repo, state } = makeFakeRepo(5_000, 100_000)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    const output = await useCase.execute()

    // `withCronAudit` só marca `success` (e grava o metadata com o cursor) quando
    // o Output é válido. Um corte parcial que devolvesse Output(false) deixaria a
    // execução como `failed` e o cursor não seria persistido.
    expect(output.isValid).toBe(true)
    expect(output.successMessages[0]).toContain("Backfill parcial")
    expect((output.result as { remaining: number }).remaining).toBeGreaterThan(0)
  })

  it("respeita RADAR_BACKFILL_TIME_BUDGET_MS", async () => {
    process.env.RADAR_BACKFILL_TIME_BUDGET_MS = "1"

    const { repo, state } = makeFakeRepo(5_000, 100_000)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    const output = await useCase.execute()
    const result = output.result as { timeBudgetMs: number; batches: number }

    expect(result.timeBudgetMs).toBe(1)
    expect(result.batches).toBe(1)
  })
})

describe("T-R2.2 — retomada continua do cursor, não do zero", () => {
  it("começa a varredura no cursor da última execução bem-sucedida", async () => {
    const { repo, state } = makeFakeRepo(5_000, 100_000)

    const first = await new RadarEngagementBackfillUseCase(
      repo,
      noResumePoint(),
      () => state.clock
    ).execute()
    const firstResult = first.result as { cursorId: string; processed: number }

    state.clock = 0
    state.listCalls.length = 0

    const second = await new RadarEngagementBackfillUseCase(
      repo,
      makeCronExecutions(firstResult),
      () => state.clock
    ).execute()
    const secondResult = second.result as { resumedFrom: { cursorId: string } | null }

    expect(secondResult.resumedFrom?.cursorId).toBe(firstResult.cursorId)
    expect(state.listCalls[0]?.cursorId).toBe(firstResult.cursorId)
  })

  it("não repontua perfil já processado na execução anterior", async () => {
    const { repo, state } = makeFakeRepo(5_000, 100_000)

    const first = await new RadarEngagementBackfillUseCase(
      repo,
      noResumePoint(),
      () => state.clock
    ).execute()
    const processedFirst = [...state.scoredOrder]

    state.clock = 0
    await new RadarEngagementBackfillUseCase(
      repo,
      makeCronExecutions(first.result),
      () => state.clock
    ).execute()

    // Nenhum id aparece duas vezes: o trabalho avança de verdade a cada execução.
    expect(new Set(state.scoredOrder).size).toBe(state.scoredOrder.length)
    expect(state.scoredOrder.slice(0, processedFirst.length)).toEqual(processedFirst)
  })

  it("recomeça do zero quando não há execução anterior legível", async () => {
    const { repo, state } = makeFakeRepo(5_000, 100_000)
    const useCase = new RadarEngagementBackfillUseCase(
      repo,
      makeCronExecutions({ lixo: true }),
      () => state.clock
    )

    const output = await useCase.execute()

    expect((output.result as { resumedFrom: unknown }).resumedFrom).toBeNull()
    expect(state.listCalls[0]?.cursorId).toBeNull()
  })
})

describe("lote agregado e ordem de prioridade", () => {
  it("escreve por lote, não por perfil (mata o N+1 do B4)", async () => {
    const { repo, state } = makeFakeRepo(500)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    await useCase.execute()

    // 500 perfis: 3 lotes para zerar a dívida de score + 3 na fase de refresh
    // (o score precisa decair, então a base é revisitada). Seis escritas, não
    // 500 — antes era 1 findMany + 1 updateMany POR PERFIL.
    expect(state.batchSizes).toEqual([200, 200, 100, 200, 200, 100])
    expect(state.batchSizes.every((size) => size <= 200)).toBe(true)
  })

  it("ataca primeiro a dívida de score ausente, e só depois revisa a base", async () => {
    const { repo, state } = makeFakeRepo(300)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    const output = await useCase.execute()
    const result = output.result as { cycleCompleted: boolean; remaining: number }

    // As fases sem score vêm antes da fase de refresh.
    const missingScorePhaseCalls = state.listCalls.filter((call) => call.onlyMissingScore === true)
    const refreshPhaseCalls = state.listCalls.filter((call) => call.onlyMissingScore === false)
    expect(missingScorePhaseCalls.length).toBeGreaterThan(0)
    expect(state.listCalls.indexOf(missingScorePhaseCalls[0]!)).toBeLessThan(
      state.listCalls.indexOf(refreshPhaseCalls[0]!)
    )

    expect(result.cycleCompleted).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("reporta progresso para o acompanhamento pós-deploy (T-R2.4)", async () => {
    const { repo, state } = makeFakeRepo(300)
    const useCase = new RadarEngagementBackfillUseCase(repo, noResumePoint(), () => state.clock)

    const output = await useCase.execute()
    const result = output.result as Record<string, unknown>

    // Estes campos são o que a consulta de acompanhamento lê em
    // backoffice_cron_executions.metadata.
    expect(result).toHaveProperty("processed")
    expect(result).toHaveProperty("remaining")
    expect(result).toHaveProperty("phase")
    expect(result).toHaveProperty("cursorId")
    expect(result).toHaveProperty("durationMs")
  })
})
