import { describe, expect, it, mock } from "bun:test"
import type { BackofficeCronExecution } from "@prisma/client"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"
import { withCronAudit } from "./withCronAudit"

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
})
