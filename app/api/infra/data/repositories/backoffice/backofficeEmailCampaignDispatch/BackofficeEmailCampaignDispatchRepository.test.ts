import { beforeEach, describe, expect, it, mock } from "bun:test"

const findUniqueMock = mock(async () => null as { id: string } | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeEmailCampaignDispatch: {
      findUnique: findUniqueMock,
    },
  },
}))

const { BackofficeEmailCampaignDispatchRepository } = await import(
  "./BackofficeEmailCampaignDispatchRepository"
)

describe("BackofficeEmailCampaignDispatchRepository — findById (consumer da fila)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    findUniqueMock.mockImplementation(async () => null)
  })

  it("busca o dispatch por id", async () => {
    const fakeDispatch = { id: "dispatch-1" }
    findUniqueMock.mockImplementationOnce(async () => fakeDispatch)
    const repo = new BackofficeEmailCampaignDispatchRepository()

    const result = await repo.findById("dispatch-1")

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "dispatch-1" } })
    expect(result).toEqual(fakeDispatch as never)
  })

  it("retorna null quando o dispatch não existe", async () => {
    const repo = new BackofficeEmailCampaignDispatchRepository()

    const result = await repo.findById("dispatch-inexistente")

    expect(result).toBeNull()
  })
})
