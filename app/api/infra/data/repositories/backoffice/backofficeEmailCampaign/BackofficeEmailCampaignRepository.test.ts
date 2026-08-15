import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyMock = mock(async () => [] as Array<{ id: string; status: string }>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeEmailCampaign: {
      findMany: findManyMock,
    },
  },
}))

const { BackofficeEmailCampaignRepository, STUCK_SENDING_THRESHOLD_MS } = await import(
  "./BackofficeEmailCampaignRepository"
)

describe("BackofficeEmailCampaignRepository — findStuckSending", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    findManyMock.mockImplementation(async () => [])
  })

  it("busca campanhas em sending atualizadas antes do threshold, sem alterar status", async () => {
    const repo = new BackofficeEmailCampaignRepository()
    const olderThan = new Date("2026-08-15T12:00:00.000Z")

    await repo.findStuckSending(olderThan)

    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: "sending", updatedAt: { lt: olderThan } },
    })
  })

  it("retorna as campanhas encontradas sem transformar o resultado", async () => {
    const fakeCampaign = { id: "campaign-1", status: "sending" }
    findManyMock.mockImplementationOnce(async () => [fakeCampaign])
    const repo = new BackofficeEmailCampaignRepository()

    const result = await repo.findStuckSending(new Date())

    expect(result).toEqual([fakeCampaign] as never)
  })
})

describe("STUCK_SENDING_THRESHOLD_MS", () => {
  it("equivale a 30 minutos em milissegundos", () => {
    expect(STUCK_SENDING_THRESHOLD_MS).toBe(30 * 60 * 1000)
  })
})
