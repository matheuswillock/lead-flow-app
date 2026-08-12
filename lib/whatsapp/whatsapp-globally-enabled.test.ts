import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(
  async (_args?: {
    where?: { slug?: string }
    select?: { isActive?: boolean }
  }): Promise<{ isActive: boolean } | null> => null
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeFeature: {
      findFirst: findFirstMock,
    },
  },
}))

const {
  isWhatsAppGloballyEnabled,
  resetWhatsAppGloballyEnabledCacheForTests,
} = await import("./whatsapp-globally-enabled")

describe("isWhatsAppGloballyEnabled", () => {
  beforeEach(() => {
    resetWhatsAppGloballyEnabledCacheForTests()
    findFirstMock.mockClear()
    findFirstMock.mockImplementation(async () => null)
  })

  it("retorna false (fail-closed) quando a query do Prisma lança erro", async () => {
    findFirstMock.mockImplementation(async () => {
      throw new Error("P2024: Timed out fetching a new connection from the connection pool")
    })

    const result = await isWhatsAppGloballyEnabled()

    expect(result).toBe(false)
    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })

  it("retorna false quando não há cache válido e isActive é false no banco", async () => {
    findFirstMock.mockImplementation(async () => ({ isActive: false }))

    const result = await isWhatsAppGloballyEnabled()

    expect(result).toBe(false)
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    expect(findFirstMock.mock.calls[0]?.[0]).toEqual({
      where: { slug: "whatsapp" },
      select: { isActive: true },
    })
  })

  it("com cache válido não consulta o banco de novo", async () => {
    findFirstMock.mockImplementation(async () => ({ isActive: false }))

    const first = await isWhatsAppGloballyEnabled()
    const second = await isWhatsAppGloballyEnabled()

    expect(first).toBe(false)
    expect(second).toBe(false)
    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })
})
