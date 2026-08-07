import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"
import { describe, expect, it, mock } from "bun:test"

const findUnique = mock(async (_args: unknown) => null as { engine: string } | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamWhatsAppConfig: {
      findUnique,
    },
  },
}))

const openWaProvider = { __brand: "openwa" as const } as unknown as IWhatsAppProvider

mock.module("@/app/api/services/whatsapp/provider/OpenWaWhatsAppProvider", () => ({
  openWaWhatsAppProvider: openWaProvider,
}))

const { WhatsAppEngineFactory } = await import("./WhatsAppEngineFactory")

describe("WhatsAppEngineFactory", () => {
  it("retorna OpenWA quando config ausente", async () => {
    findUnique.mockImplementation(async () => null)
    const provider = await WhatsAppEngineFactory.forTeam("team-1")
    expect(provider).toBe(openWaProvider)
  })

  it("retorna OpenWA quando engine=OPENWA", async () => {
    findUnique.mockImplementation(async () => ({ engine: "OPENWA" }))
    const provider = await WhatsAppEngineFactory.forTeam("team-1")
    expect(provider).toBe(openWaProvider)
    expect(findUnique).toHaveBeenCalled()
  })

  it("lança erro claro para engine=META (Spec 03)", async () => {
    findUnique.mockImplementation(async () => ({ engine: "META" }))
    await expect(WhatsAppEngineFactory.forTeam("team-1")).rejects.toThrow(/Spec 03/i)
  })
})
