import { beforeEach, describe, expect, it, mock } from "bun:test"

type UpdateManyArgs = {
  where?: { id?: string; status?: string }
  data?: { status?: string; attemptCount?: number; nextAttemptAt?: Date }
}

const findManyMock = mock(async () => [] as Array<Record<string, unknown>>)
const updateManyMock = mock(async (_args?: UpdateManyArgs) => ({ count: 1 }))
const upsertMock = mock(async (_args?: unknown) => ({}))
const findUniqueMock = mock(async (_args?: unknown) => null as { status: string } | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormQueueEventFailure: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
  },
}))

const { PublicFormQueueEventFailureRepository } = await import(
  "./PublicFormQueueEventFailureRepository"
)

describe("PublicFormQueueEventFailureRepository (PR2.3)", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    updateManyMock.mockClear()
    upsertMock.mockClear()
    findUniqueMock.mockClear()
    findManyMock.mockImplementation(async () => [])
    updateManyMock.mockImplementation(async () => ({ count: 1 }))
    findUniqueMock.mockImplementation(async () => null)
  })

  it("upsertFromProcessingFailure cria linha pending com kind e failureReason", async () => {
    const repo = new PublicFormQueueEventFailureRepository()
    await repo.upsertFromProcessingFailure({
      kind: "submission",
      idempotencyKey: "req-1",
      payload: { submissionId: "sub-1" },
      lastError: "queue down",
      failureReason: "queue_publish_failed",
    })

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const call = upsertMock.mock.calls[0]?.[0] as {
      where: { idempotencyKey: string }
      create: { kind: string; status: string; failureReason: string }
    }
    expect(call.where.idempotencyKey).toBe("req-1")
    expect(call.create.kind).toBe("submission")
    expect(call.create.status).toBe("pending")
    expect(call.create.failureReason).toBe("queue_publish_failed")
  })

  it("upsertFromProcessingFailure não regrava linha já resolvida", async () => {
    findUniqueMock.mockImplementation(async () => ({ status: "resolved" }))
    const repo = new PublicFormQueueEventFailureRepository()
    await repo.upsertFromProcessingFailure({
      kind: "metric",
      idempotencyKey: "evt-1",
      payload: { eventKey: "evt-1" },
      lastError: "queue down",
      failureReason: "queue_publish_failed",
    })

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("claimDue recupera linhas processing abandonadas antes de reivindicar pending", async () => {
    findManyMock.mockImplementation(async (args?: { where?: { status?: string } }) => {
      if (args?.where?.status === "processing") {
        return [{ id: "row-stale", attemptCount: 1 }]
      }
      return []
    })

    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string }
      data?: { status?: string; attemptCount?: number }
    }) => {
      if (args?.where?.id === "row-stale" && args?.where?.status === "processing") {
        expect(args.data?.attemptCount).toBe(2)
        expect(args.data?.status).toBe("pending")
        return { count: 1 }
      }
      return { count: 0 }
    })

    const repo = new PublicFormQueueEventFailureRepository()
    await repo.claimDue(10)

    expect(findManyMock).toHaveBeenCalled()
  })

  it("markRetryOrFailed marca failed quando attemptCount atinge o teto (5)", async () => {
    const repo = new PublicFormQueueEventFailureRepository()
    const outcome = await repo.markRetryOrFailed("row-1", 5, "erro definitivo")

    expect(outcome).toBe("failed")
    const call = updateManyMock.mock.calls.at(-1)?.[0] as {
      data?: { status?: string; attemptCount?: number }
    }
    expect(call?.data?.status).toBe("failed")
    expect(call?.data?.attemptCount).toBe(5)
  })

  it("markRetryOrFailed marca pending com nextAttemptAt futuro quando ainda há tentativas", async () => {
    const repo = new PublicFormQueueEventFailureRepository()
    const outcome = await repo.markRetryOrFailed("row-1", 2, "erro transitório")

    expect(outcome).toBe("retried")
    const call = updateManyMock.mock.calls.at(-1)?.[0] as {
      data?: { status?: string; attemptCount?: number; nextAttemptAt?: Date }
    }
    expect(call?.data?.status).toBe("pending")
    expect(call?.data?.attemptCount).toBe(2)
    expect(call?.data?.nextAttemptAt).toBeInstanceOf(Date)
  })
})
