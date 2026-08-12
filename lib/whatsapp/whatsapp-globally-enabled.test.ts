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
  resolveWhatsAppGlobalFeatureGate,
  resetWhatsAppGloballyEnabledCacheForTests,
} = await import("./whatsapp-globally-enabled")

describe("resolveWhatsAppGlobalFeatureGate / isWhatsAppGloballyEnabled", () => {
  beforeEach(() => {
    resetWhatsAppGloballyEnabledCacheForTests()
    findFirstMock.mockClear()
    findFirstMock.mockImplementation(async () => null)
  })

  it("retorna lookup_failed (fail-closed) quando a query do Prisma lança erro", async () => {
    findFirstMock.mockImplementation(async () => {
      throw new Error("P2024: Timed out fetching a new connection from the connection pool")
    })

    const gate = await resolveWhatsAppGlobalFeatureGate()
    expect(gate.status).toBe("lookup_failed")
    expect(await isWhatsAppGloballyEnabled()).toBe(false)
    expect(findFirstMock).toHaveBeenCalledTimes(2)
  })

  it("retorna disabled quando não há cache válido e isActive é false no banco", async () => {
    findFirstMock.mockImplementation(async () => ({ isActive: false }))

    const gate = await resolveWhatsAppGlobalFeatureGate()
    expect(gate).toEqual({ status: "disabled" })
    expect(await isWhatsAppGloballyEnabled()).toBe(false)
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    expect(findFirstMock.mock.calls[0]?.[0]).toEqual({
      where: { slug: "whatsapp" },
      select: { isActive: true },
    })
  })

  it("com cache válido não consulta o banco de novo", async () => {
    findFirstMock.mockImplementation(async () => ({ isActive: false }))

    const first = await resolveWhatsAppGlobalFeatureGate()
    const second = await resolveWhatsAppGlobalFeatureGate()

    expect(first).toEqual({ status: "disabled" })
    expect(second).toEqual({ status: "disabled" })
    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })

  it("retorna enabled quando isActive é true", async () => {
    findFirstMock.mockImplementation(async () => ({ isActive: true }))
    await expect(resolveWhatsAppGlobalFeatureGate()).resolves.toEqual({ status: "enabled" })
    await expect(isWhatsAppGloballyEnabled()).resolves.toBe(true)
  })
})
