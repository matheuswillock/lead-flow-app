import { describe, expect, it, mock } from "bun:test"
import type { BackofficeCronExecution, Prisma } from "@prisma/client"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"
import { withCronAudit } from "./withCronAudit"
import {
  buildSkippedCronOutput,
  CRON_SKIP_REASON_FEATURE_DISABLED,
} from "./cronSkippedOutput"

function makeExecution(id = "exec-1"): BackofficeCronExecution {
  return {
    id,
    cronKey: "test",
    cronPath: "/test",
    status: "running",
    startedAt: new Date(),
    finishedAt: null,
    durationMs: null,
    errorSummary: null,
    errorDetail: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe("withCronAudit", () => {
  it("executa o handler quando repository.create falha", async () => {
    const handler = mock(async () => "ok" as const)
    const markSuccess = mock(async () => makeExecution())
    const markFailed = mock(async () => makeExecution())

    const repository: IBackofficeCronExecutionRepository = {
      create: async () => {
        throw new Error("backoffice_cron_executions does not exist")
      },
      findMany: async () => [],
      findStaleRunningCandidates: async () => [],
      claimStaleRunningAsFailed: async () => true,
      markSuccess,
      markFailed,
    }

    const result = await withCronAudit(
      { cronKey: "test", cronPath: "/test" },
      handler,
      { repository }
    )

    expect(handler).toHaveBeenCalledTimes(1)
    expect(result).toBe("ok")
    expect(markSuccess).not.toHaveBeenCalled()
    expect(markFailed).not.toHaveBeenCalled()
  })

  it("propaga erro do handler mesmo quando create falhou", async () => {
    const handler = mock(async () => {
      throw new Error("handler failed")
    })

    const repository: IBackofficeCronExecutionRepository = {
      create: async () => {
        throw new Error("db down")
      },
      findMany: async () => [],
      findStaleRunningCandidates: async () => [],
      claimStaleRunningAsFailed: async () => true,
      markSuccess: async () => makeExecution(),
      markFailed: async () => makeExecution(),
    }

    await expect(
      withCronAudit({ cronKey: "test", cronPath: "/test" }, handler, { repository })
    ).rejects.toThrow("handler failed")
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("marca sucesso quando create e handler funcionam", async () => {
    const handler = mock(async () => ({ result: { processed: 1 } }))
    const markSuccess = mock(async () => makeExecution())

    const repository: IBackofficeCronExecutionRepository = {
      create: async () => makeExecution(),
      findMany: async () => [],
      findStaleRunningCandidates: async () => [],
      claimStaleRunningAsFailed: async () => true,
      markSuccess,
      markFailed: async () => makeExecution(),
    }

    await withCronAudit({ cronKey: "test", cronPath: "/test" }, handler, { repository })

    expect(markSuccess).toHaveBeenCalledTimes(1)
  })

  it("marca falha quando handler retorna Output inválido", async () => {
    const handler = mock(async () => ({
      isValid: false,
      successMessages: [],
      errorMessages: ["backfill failed"],
      result: null,
    }))
    const markSuccess = mock(async () => makeExecution())
    const markFailed = mock(async () => makeExecution())
    const onFailure = mock(async () => undefined)

    const repository: IBackofficeCronExecutionRepository = {
      create: async () => makeExecution("exec-invalid"),
      findMany: async () => [],
      findStaleRunningCandidates: async () => [],
      claimStaleRunningAsFailed: async () => true,
      markSuccess,
      markFailed,
    }

    const result = await withCronAudit(
      { cronKey: "test", cronPath: "/test" },
      handler,
      { repository, onFailure }
    )

    expect(result).toEqual({
      isValid: false,
      successMessages: [],
      errorMessages: ["backfill failed"],
      result: null,
    })
    expect(markSuccess).not.toHaveBeenCalled()
    expect(markFailed).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it("T-Q5.1 — gate off: registra execução success com {skipped:'feature_disabled'}", async () => {
    const markSuccess = mock(
      async (_id: string, _durationMs: number, _metadata?: Prisma.InputJsonValue) =>
        makeExecution(),
    )
    const markFailed = mock(async () => makeExecution())
    const onFailure = mock(async () => undefined)

    const repository: IBackofficeCronExecutionRepository = {
      create: async () => makeExecution("exec-skipped"),
      findMany: async () => [],
      markSuccess,
      markFailed,
    }

    const result = await withCronAudit(
      { cronKey: "ingest-media", cronPath: "/api/v1/whatsapp/cron/ingest-media" },
      async () => buildSkippedCronOutput(CRON_SKIP_REASON_FEATURE_DISABLED),
      { repository, onFailure }
    )

    expect(result.isValid).toBe(true)
    expect(result.result).toEqual({ skipped: "feature_disabled" })
    expect(markFailed).not.toHaveBeenCalled()
    expect(onFailure).not.toHaveBeenCalled()
    expect(markSuccess).toHaveBeenCalledTimes(1)
    expect(markSuccess.mock.calls[0]?.[2]).toEqual({ skipped: "feature_disabled" })
  })
})

describe("buildSkippedCronOutput", () => {
  it("é um Output válido que carrega o motivo do skip no result", () => {
    const output = buildSkippedCronOutput(CRON_SKIP_REASON_FEATURE_DISABLED)

    expect(output.isValid).toBe(true)
    expect(output.errorMessages).toEqual([])
    expect(output.result).toEqual({ skipped: "feature_disabled" })
    expect(output.successMessages).toEqual(["Execução ignorada: feature_disabled"])
  })
})
