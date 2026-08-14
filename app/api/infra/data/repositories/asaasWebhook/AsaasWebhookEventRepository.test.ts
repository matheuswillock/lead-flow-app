import { beforeEach, describe, expect, it, mock } from "bun:test"
import { ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS } from "@/lib/webhooks/asaas-webhook-event-backoff"

const findManyMock = mock(async () => [] as Array<Record<string, unknown>>)
const updateManyMock = mock(async () => ({ count: 1 }))
const updateMock = mock(async () => ({}))
const findUniqueMock = mock(async () => null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    asaasWebhookEvent: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      update: updateMock,
      findUnique: findUniqueMock,
    },
  },
}))

const { AsaasWebhookEventRepository } = await import("./AsaasWebhookEventRepository")

type FindManyArgs = {
  where?: {
    status?: string
    nextAttemptAt?: { lte: Date }
    OR?: Array<{
      status?: string
      attemptCount?: { lt: number }
    }>
  }
}

function isDueQuery(args?: FindManyArgs): boolean {
  return Array.isArray(args?.where?.OR)
}

describe("AsaasWebhookEventRepository", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    updateManyMock.mockClear()
    updateMock.mockClear()
    findUniqueMock.mockClear()
    findManyMock.mockImplementation(async () => [])
    updateManyMock.mockImplementation(async () => ({ count: 1 }))
  })

  it("claimDue recupera linhas processing abandonadas antes de reivindicar pending/failed", async () => {
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

    const repo = new AsaasWebhookEventRepository()
    await repo.claimDue(10)

    expect(findManyMock).toHaveBeenCalled()
    const staleQuery = (
      findManyMock.mock.calls as unknown as Array<
        [{ where: { status: string; updatedAt: { lt: Date } } }]
      >
    ).find((call) => call[0]?.where?.status === "processing")
    expect(staleQuery).toBeDefined()
  })

  it("claimDue não reclama failed com attemptCount >= ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS", async () => {
    const repo = new AsaasWebhookEventRepository()
    const claimed = await repo.claimDue(10)

    expect(claimed).toEqual([])

    const dueQuery = (findManyMock.mock.calls as unknown as Array<[FindManyArgs]>).find(
      (call) => isDueQuery(call[0])
    )
    expect(dueQuery).toBeDefined()
    expect(dueQuery?.[0]?.where?.OR).toEqual([
      { status: "pending" },
      {
        status: "failed",
        attemptCount: { lt: ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS },
      },
    ])
    expect(dueQuery?.[0]?.where?.nextAttemptAt).toEqual(
      expect.objectContaining({ lte: expect.any(Date) })
    )
  })

  it("claimDue reclama failed com attemptCount abaixo do máximo", async () => {
    const retryable = {
      id: "row-retryable",
      eventType: "PAYMENT_RECEIVED",
      payload: { id: "evt-1" },
      attemptCount: 2,
    }

    findManyMock.mockImplementation(async (args?: FindManyArgs) => {
      if (args?.where?.status === "processing") return []
      if (isDueQuery(args)) return [retryable]
      return []
    })

    updateManyMock.mockImplementation(async () => ({ count: 1 }))

    const repo = new AsaasWebhookEventRepository()
    const claimed = await repo.claimDue(10)

    expect(claimed).toEqual([retryable])
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-retryable", status: { in: ["pending", "failed"] } },
        data: { status: "processing" },
      })
    )
  })

  it("markRetryOrFailed marca failed quando attemptCount atinge o teto", async () => {
    const repo = new AsaasWebhookEventRepository()
    const result = await repo.markRetryOrFailed(
      "row-exhausted",
      ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS,
      "handler blew up"
    )

    expect(result).toBe("failed")
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-exhausted", status: "processing" },
        data: expect.objectContaining({
          status: "failed",
          attemptCount: ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS,
          errorMessage: "handler blew up",
        }),
      })
    )
    const data = (
      updateManyMock.mock.calls as unknown as Array<[{ data?: { nextAttemptAt?: Date } }]>
    )[0]?.[0]?.data
    expect(data).not.toHaveProperty("nextAttemptAt")
  })

  it("markRetryOrFailed marca pending com nextAttemptAt futuro quando ainda há tentativas", async () => {
    const before = Date.now()
    const repo = new AsaasWebhookEventRepository()
    const result = await repo.markRetryOrFailed("row-retry", 2, "temporary failure")

    expect(result).toBe("retried")
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-retry", status: "processing" },
        data: expect.objectContaining({
          status: "pending",
          attemptCount: 2,
          errorMessage: "temporary failure",
        }),
      })
    )
    const data = (
      updateManyMock.mock.calls as unknown as Array<[{ data?: { nextAttemptAt?: Date } }]>
    )[0]?.[0]?.data
    expect(data?.nextAttemptAt).toBeInstanceOf(Date)
    expect(data?.nextAttemptAt?.getTime()).toBeGreaterThan(before)
  })
})
