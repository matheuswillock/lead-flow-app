import { describe, expect, it, mock } from "bun:test"
import type {
  IEmailSendingHealthRepository,
  TeamSendingHealthEvaluationRow,
  UpdateTeamSendingHealthInput,
} from "@/app/api/infra/data/repositories/emailSendingHealth/IEmailSendingHealthRepository"
import type { SendingHealthSnapshot, SendingHealthWindowMetrics } from "@/lib/email/sending-health"

// O UseCase notifica o owner via `@/lib/email/notify-sending-health-change`,
// que importa infra `server-only`. Dependências reais entram por DI
// (repository fake); o stub existe só para o módulo carregar no bun:test.
mock.module("@/lib/email/notify-sending-health-change", () => ({
  notifySendingHealthChanged: async () => {},
}))

const { EvaluateTeamSendingHealthUseCase } = await import("./EvaluateTeamSendingHealthUseCase")

const NOW = new Date("2026-09-17T12:00:00.000Z")
const TEAM_ID = "team-1"

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function windows(overrides: Partial<SendingHealthWindowMetrics> = {}): SendingHealthWindowMetrics {
  return {
    sent7d: 1000,
    hardBounced7d: 0,
    complained7d: 0,
    sent30d: 4000,
    hardBounced30d: 0,
    complained30d: 0,
    ...overrides,
  }
}

/**
 * Snapshot de um time `warned` liberado manualmente há 1 dia (dentro dos 7
 * dias de validade do baseline), com o incidente original de 1000
 * envios/80 hard bounces (8%) preso na marca de água.
 */
function releasedSnapshotJson(releasedAt: Date): SendingHealthSnapshot {
  const incidentWindows = windows({ sent7d: 1000, hardBounced7d: 80 })
  return {
    computedAt: releasedAt.toISOString(),
    windows: incidentWindows,
    rates: { hardBounceRate7d: 0.08, complaintRate7d: 0, hasMinimumVolume: true },
    belowWarnSince: null,
    pauseHistory: [daysAgo(2).toISOString()],
    releaseBaseline: { at: releasedAt.toISOString(), windows: incidentWindows },
  }
}

type FakeRepositoryOptions = {
  row: TeamSendingHealthEvaluationRow
  /** Contagem "desde a liberação" que `getWindowMetricsSince` deve devolver. */
  sinceReleaseCounts: Pick<SendingHealthWindowMetrics, "sent7d" | "hardBounced7d" | "complained7d">
}

function makeFakeRepository(options: FakeRepositoryOptions) {
  const updates: UpdateTeamSendingHealthInput[] = []
  const sinceCalls: Array<{ teamId: string; since: Date; now: Date }> = []
  const repository: IEmailSendingHealthRepository = {
    async listTeamsForEvaluation() {
      return [options.row]
    },
    async getTeamSendingHealth() {
      return null
    },
    async updateTeamSendingHealth(input) {
      updates.push(input)
    },
    async getDispatchBounceStats() {
      return { sentCount: 0, hardBouncedCount: 0 }
    },
    async getWindowMetricsSince(teamId, since, now) {
      sinceCalls.push({ teamId, since, now })
      return options.sinceReleaseCounts
    },
  }
  return { repository, updates, sinceCalls }
}

describe("EvaluateTeamSendingHealthUseCase — baseline de liberação", () => {
  /**
   * REGRESSÃO do achado P1 do codex (PR #1204): a janela CRUA de 7d ficou
   * estável (churn de volume — 500 envios antigos saem, 500 novos ruins
   * entram), o que fazia a antiga subtração (`janela atual − janela na
   * liberação`) dar zero e o cron nunca conseguia pausar de novo. A consulta
   * direta via `getWindowMetricsSince` (parametrizada com `since` =
   * `releaseBaseline.at`) enxerga os 500 envios novos, 100% ruins, e o time
   * tem que ser pausado (2ª pausa em 30d ⇒ suspenso).
   */
  it("consulta direta desde a liberação detecta incidente novo mascarado por churn de volume", async () => {
    const releasedAt = daysAgo(1)
    const row: TeamSendingHealthEvaluationRow = {
      teamId: TEAM_ID,
      masterProfileId: "master-1",
      status: "warned",
      reason: "liberado",
      changedAt: releasedAt,
      metricsJson: releasedSnapshotJson(releasedAt) as unknown as TeamSendingHealthEvaluationRow["metricsJson"],
      // Janela crua "estagnada": mesmo sent7d do baseline (1000) — é o que a
      // subtração via para "zero líquido".
      windows: windows({ sent7d: 1000, hardBounced7d: 80 }),
    }
    const { repository, updates, sinceCalls } = makeFakeRepository({
      row,
      // O que REALMENTE aconteceu desde a liberação: 500 envios novos, todos
      // com hard bounce.
      sinceReleaseCounts: { sent7d: 500, hardBounced7d: 500, complained7d: 0 },
    })

    const useCase = new EvaluateTeamSendingHealthUseCase(repository)
    const output = await useCase.execute(NOW)

    expect(output.isValid).toBe(true)
    expect(sinceCalls).toHaveLength(1)
    expect(sinceCalls[0]?.teamId).toBe(TEAM_ID)
    expect(sinceCalls[0]?.since.toISOString()).toBe(releasedAt.toISOString())

    expect(updates).toHaveLength(1)
    // 2ª pausa em 30 dias (havia uma pausa há 2 dias no histórico) ⇒ suspenso.
    expect(updates[0]?.transition?.status).toBe("suspended")
  })

  it("sem eventos novos desde a liberação, o time NÃO é repausado", async () => {
    const releasedAt = daysAgo(0.01)
    const row: TeamSendingHealthEvaluationRow = {
      teamId: TEAM_ID,
      masterProfileId: "master-1",
      status: "warned",
      reason: "liberado",
      changedAt: releasedAt,
      metricsJson: releasedSnapshotJson(releasedAt) as unknown as TeamSendingHealthEvaluationRow["metricsJson"],
      windows: windows({ sent7d: 1000, hardBounced7d: 80 }),
    }
    const { repository, updates } = makeFakeRepository({
      row,
      sinceReleaseCounts: { sent7d: 0, hardBounced7d: 0, complained7d: 0 },
    })

    const useCase = new EvaluateTeamSendingHealthUseCase(repository)
    await useCase.execute(NOW)

    // Sem transição de status — só o snapshot é atualizado (mesma janela).
    expect(updates).toHaveLength(1)
    expect(updates[0]?.transition).toBeUndefined()
  })

  it("baseline expirado (>7 dias): usa a janela crua sem chamar getWindowMetricsSince", async () => {
    const releasedAt = daysAgo(8)
    const row: TeamSendingHealthEvaluationRow = {
      teamId: TEAM_ID,
      masterProfileId: "master-1",
      status: "warned",
      reason: "liberado",
      changedAt: releasedAt,
      metricsJson: releasedSnapshotJson(releasedAt) as unknown as TeamSendingHealthEvaluationRow["metricsJson"],
      windows: windows({ sent7d: 50, hardBounced7d: 0 }),
    }
    const { repository, sinceCalls } = makeFakeRepository({
      row,
      sinceReleaseCounts: { sent7d: 999, hardBounced7d: 999, complained7d: 0 },
    })

    const useCase = new EvaluateTeamSendingHealthUseCase(repository)
    await useCase.execute(NOW)

    expect(sinceCalls).toHaveLength(0)
  })
})
