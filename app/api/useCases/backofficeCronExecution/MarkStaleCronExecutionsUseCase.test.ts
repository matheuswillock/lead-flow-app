import { describe, expect, it, mock } from "bun:test"
import type { BackofficeCronExecution } from "@prisma/client"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"
import {
  MarkStaleCronExecutionsUseCase,
  MAX_DURATION_MS,
  STALE_CRON_EXECUTION_ERROR_SUMMARY,
} from "./MarkStaleCronExecutionsUseCase"

const NOW = new Date("2026-08-24T12:00:00.000Z")

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000)
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function makeRunningExecution(
  overrides: Partial<BackofficeCronExecution> & Pick<BackofficeCronExecution, "id" | "cronKey">,
): BackofficeCronExecution {
  return {
    cronPath: `/api/v1/${overrides.cronKey}`,
    status: "running",
    startedAt: minutesAgo(90),
    finishedAt: null,
    durationMs: null,
    errorSummary: null,
    errorDetail: null,
    metadata: null,
    createdAt: minutesAgo(90),
    updatedAt: minutesAgo(90),
    ...overrides,
  } as BackofficeCronExecution
}

function makeRepository(
  candidates: BackofficeCronExecution[],
  claim: IBackofficeCronExecutionRepository["claimStaleRunningAsFailed"],
): IBackofficeCronExecutionRepository {
  return {
    create: async () => makeRunningExecution({ id: "created", cronKey: "any" }),
    findMany: async () => [],
    markSuccess: async () => makeRunningExecution({ id: "success", cronKey: "any" }),
    markFailed: async () => makeRunningExecution({ id: "failed", cronKey: "any" }),
    findStaleRunningCandidates: async () => candidates,
    claimStaleRunningAsFailed: claim,
  }
}

describe("MarkStaleCronExecutionsUseCase", () => {
  it("T-Q1.1 — marca apenas execuções além do teto do próprio cronKey", async () => {
    // database-backup: maxDuration 300s → teto 600s. 8min ainda é execução legítima.
    const backupEmAndamento = makeRunningExecution({
      id: "backup-ok",
      cronKey: "database-backup",
      startedAt: minutesAgo(8),
    })
    // dispatch-scheduled: maxDuration 60s → teto 120s. 8min é órfã.
    const dispatchOrfa = makeRunningExecution({
      id: "dispatch-orfa",
      cronKey: "dispatch-scheduled",
      startedAt: minutesAgo(8),
    })

    const claimStaleRunningAsFailed = mock(async () => true)
    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository([backupEmAndamento, dispatchOrfa], claimStaleRunningAsFailed),
      mock(async () => {}),
      () => NOW,
    )

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(claimStaleRunningAsFailed).toHaveBeenCalledTimes(1)
    expect(claimStaleRunningAsFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dispatch-orfa",
        errorSummary: STALE_CRON_EXECUTION_ERROR_SUMMARY,
        durationMs: 8 * 60 * 1000,
      }),
    )
    expect(output.result).toEqual(
      expect.objectContaining({ scanned: 2, markedFailed: 1, skippedWithinThreshold: 1 }),
    )
  })

  it("T-Q1.1 — respeita o teto longo de radar-sync-email-contacts e database-backup", async () => {
    const candidatos = [
      makeRunningExecution({
        id: "radar-sync",
        cronKey: "radar-sync-email-contacts",
        startedAt: minutesAgo(5),
      }),
      makeRunningExecution({
        id: "backup",
        cronKey: "database-backup",
        startedAt: minutesAgo(9),
      }),
    ]
    const claimStaleRunningAsFailed = mock(async () => true)

    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository(candidatos, claimStaleRunningAsFailed),
      mock(async () => {}),
      () => NOW,
    )

    const output = await useCase.execute()

    expect(claimStaleRunningAsFailed).not.toHaveBeenCalled()
    expect(output.result).toEqual(
      expect.objectContaining({ scanned: 2, markedFailed: 0, skippedWithinThreshold: 2 }),
    )
  })

  it("T-Q1.2 — dispara onStale uma vez por execução marcada", async () => {
    const candidatos = [
      makeRunningExecution({ id: "orfa-1", cronKey: "dispatch-scheduled" }),
      makeRunningExecution({ id: "orfa-2", cronKey: "radar-import" }),
    ]
    const onStale = mock(async () => {})

    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository(candidatos, async () => true),
      onStale,
      () => NOW,
    )

    await useCase.execute()

    expect(onStale).toHaveBeenCalledTimes(2)
    expect(onStale).toHaveBeenCalledWith(
      expect.objectContaining({
        cronKey: "dispatch-scheduled",
        executionId: "orfa-1",
        error: STALE_CRON_EXECUTION_ERROR_SUMMARY,
      }),
    )
  })

  it("T-Q1.2 — não alerta quando o claim atômico perde a corrida", async () => {
    const onStale = mock(async () => {})
    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository(
        [makeRunningExecution({ id: "ja-reivindicada", cronKey: "dispatch-scheduled" })],
        async () => false,
      ),
      onStale,
      () => NOW,
    )

    const output = await useCase.execute()

    expect(onStale).not.toHaveBeenCalled()
    expect(output.result).toEqual(
      expect.objectContaining({ markedFailed: 0, alreadyClaimed: 1 }),
    )
  })

  it("falha do alerta não impede a marcação das demais execuções", async () => {
    const claimStaleRunningAsFailed = mock(async () => true)
    const onStale = mock(async () => {
      throw new Error("slack indisponível")
    })

    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository(
        [
          makeRunningExecution({ id: "orfa-1", cronKey: "dispatch-scheduled" }),
          makeRunningExecution({ id: "orfa-2", cronKey: "radar-import" }),
        ],
        claimStaleRunningAsFailed,
      ),
      onStale,
      () => NOW,
    )

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(claimStaleRunningAsFailed).toHaveBeenCalledTimes(2)
    expect(output.result).toEqual(expect.objectContaining({ markedFailed: 2 }))
  })

  it("trava durationMs no teto do Postgres Int quando a execução fica presa por semanas", async () => {
    // 30 dias em ms > MAX_DURATION_MS (teto de um Postgres Int, ~24,86 dias) — sem o
    // clamp, o UPDATE do claim estoura o range da coluna e a execução nunca é encerrada.
    const presaHaSemanas = makeRunningExecution({
      id: "presa-30-dias",
      cronKey: "dispatch-scheduled",
      startedAt: daysAgo(30),
    })
    const claimStaleRunningAsFailed = mock(async () => true)

    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository([presaHaSemanas], claimStaleRunningAsFailed),
      mock(async () => {}),
      () => NOW,
    )

    await useCase.execute()

    expect(claimStaleRunningAsFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: "presa-30-dias", durationMs: MAX_DURATION_MS }),
    )
  })

  it("não trava a varredura quando o alerta best-effort nunca resolve", async () => {
    // notifyStale que nunca resolve simula o Slack travado — sem o orçamento de
    // tempo, isso consumiria os 60s da rota antes de processar as próximas candidatas.
    const onStaleQueNuncaResolve = mock(() => new Promise<void>(() => {}))
    const claimStaleRunningAsFailed = mock(async () => true)

    const useCase = new MarkStaleCronExecutionsUseCase(
      makeRepository(
        [
          makeRunningExecution({ id: "orfa-1", cronKey: "dispatch-scheduled" }),
          makeRunningExecution({ id: "orfa-2", cronKey: "radar-import" }),
        ],
        claimStaleRunningAsFailed,
      ),
      onStaleQueNuncaResolve,
      () => NOW,
      20, // alertTimeoutMs — orçamento curto só para o teste não esperar 5s reais
    )

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual(expect.objectContaining({ markedFailed: 2 }))
  })

  it("devolve Output inválido quando a varredura falha", async () => {
    const repository = makeRepository([], async () => true)
    repository.findStaleRunningCandidates = async () => {
      throw new Error("db down")
    }

    const useCase = new MarkStaleCronExecutionsUseCase(repository, mock(async () => {}), () => NOW)

    const output = await useCase.execute()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.length).toBeGreaterThan(0)
  })
})
