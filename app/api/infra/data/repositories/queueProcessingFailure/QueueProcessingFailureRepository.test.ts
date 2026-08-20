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
    queueProcessingFailure: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
  },
  withPrismaRetry: async (fn: () => unknown) => fn(),
}))

const { QueueProcessingFailureRepository } = await import(
  "./QueueProcessingFailureRepository"
)

describe("QueueProcessingFailureRepository", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    updateManyMock.mockClear()
    upsertMock.mockClear()
    findUniqueMock.mockClear()
    findManyMock.mockImplementation(async () => [])
    updateManyMock.mockImplementation(async () => ({ count: 1 }))
    findUniqueMock.mockImplementation(async () => null)
  })

  it("upsertFromProcessingFailure cria linha pending com topic e idempotencyKey", async () => {
    const repo = new QueueProcessingFailureRepository()
    await repo.upsertFromProcessingFailure({
      topic: "public-form-metric-events",
      idempotencyKey: "evt-1",
      payload: { eventKey: "evt-1" },
      lastError: "P2024",
    })

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const call = upsertMock.mock.calls[0]?.[0] as {
      where: { topic_idempotencyKey: { topic: string; idempotencyKey: string } }
      create: { topic: string; status: string }
    }
    expect(call.where.topic_idempotencyKey).toEqual({
      topic: "public-form-metric-events",
      idempotencyKey: "evt-1",
    })
    expect(call.create.topic).toBe("public-form-metric-events")
    expect(call.create.status).toBe("pending")
  })

  it("upsertFromProcessingFailure não regrava linha já resolvida", async () => {
    findUniqueMock.mockImplementation(async () => ({ status: "resolved" }))
    const repo = new QueueProcessingFailureRepository()
    await repo.upsertFromProcessingFailure({
      topic: "public-form-metric-events",
      idempotencyKey: "evt-1",
      payload: { eventKey: "evt-1" },
      lastError: "P2024",
    })

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("markRetryOrFailed marca failed quando attemptCount atinge o teto (5)", async () => {
    const repo = new QueueProcessingFailureRepository()
    const outcome = await repo.markRetryOrFailed("row-1", 5, "erro definitivo")

    expect(outcome).toBe("failed")
    const call = updateManyMock.mock.calls.at(-1)?.[0] as {
      data?: { status?: string; attemptCount?: number }
    }
    expect(call?.data?.status).toBe("failed")
    expect(call?.data?.attemptCount).toBe(5)
  })
})
