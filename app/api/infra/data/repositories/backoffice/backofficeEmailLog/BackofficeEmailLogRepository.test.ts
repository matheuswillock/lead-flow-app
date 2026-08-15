import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyMock = mock(async () => [] as Array<{ id: string; contactId: string; recipientEmail: string }>)
const countMock = mock(async () => 0)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeEmailLog: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}))

const { BackofficeEmailLogRepository } = await import("./BackofficeEmailLogRepository")

describe("BackofficeEmailLogRepository — consumer da fila (queue-first)", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    countMock.mockClear()
    findManyMock.mockImplementation(async () => [])
    countMock.mockImplementation(async () => 0)
  })

  it("findQueuedByDispatchId filtra por dispatchId + status=queued, ordena por id e respeita o take", async () => {
    const repo = new BackofficeEmailLogRepository()
    await repo.findQueuedByDispatchId("dispatch-1", 500)

    expect(findManyMock).toHaveBeenCalledWith({
      where: { dispatchId: "dispatch-1", status: "queued" },
      select: { id: true, contactId: true, recipientEmail: true },
      orderBy: { id: "asc" },
      take: 500,
    })
  })

  it("countQueuedByDispatchId conta apenas logs em status=queued do dispatch", async () => {
    const repo = new BackofficeEmailLogRepository()
    await repo.countQueuedByDispatchId("dispatch-1")

    expect(countMock).toHaveBeenCalledWith({
      where: { dispatchId: "dispatch-1", status: "queued" },
    })
  })

  it("countSentByDispatchId exclui queued e failed (considera qualquer status confirmado como enviado)", async () => {
    const repo = new BackofficeEmailLogRepository()
    await repo.countSentByDispatchId("dispatch-1")

    expect(countMock).toHaveBeenCalledWith({
      where: {
        dispatchId: "dispatch-1",
        status: { notIn: ["queued", "failed"] },
      },
    })
  })
})
