import { describe, it, expect, mock, beforeEach } from "bun:test"
import { SyncWhatsAppHistoryUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsAppHistoryUseCase"

describe("SyncWhatsAppHistoryUseCase", () => {
  const publish = mock(async () => ({ messageId: "mid-1" }))
  const syncTeamHistory = mock(async () => ({ chats: 2, messages: 5 }))
  const syncFromWhatsapp = mock(async () => ({
    created: 0,
    enriched: 1,
    skipped: 0,
    deferred: 0,
    errors: [] as string[],
  }))

  beforeEach(() => {
    publish.mockClear()
    publish.mockImplementation(async () => ({ messageId: "mid-1" }))
    syncTeamHistory.mockClear()
    syncTeamHistory.mockImplementation(async () => ({ chats: 2, messages: 5 }))
    syncFromWhatsapp.mockClear()
  })

  it("publica wake de history e não chama syncFromWhatsapp inline", async () => {
    const useCase = new SyncWhatsAppHistoryUseCase({ publish, syncTeamHistory, syncFromWhatsapp })
    const result = await useCase.execute({ teamId: "team-1" })
    expect(result.isValid).toBe(true)
    expect(publish).toHaveBeenCalledTimes(1)
    const firstCall = publish.mock.calls[0] as unknown as [
      { source: string; teamId: string; since: string },
    ]
    expect(firstCall[0].source).toBe("history")
    expect(firstCall[0].teamId).toBe("team-1")
    expect(firstCall[0].since).toEqual(expect.any(String))
    expect(syncFromWhatsapp).not.toHaveBeenCalled()
  })

  it("sem chats/messages não publica", async () => {
    syncTeamHistory.mockImplementation(async () => ({ chats: 0, messages: 0 }))
    const useCase = new SyncWhatsAppHistoryUseCase({ publish, syncTeamHistory, syncFromWhatsapp })
    await useCase.execute({ teamId: "team-1" })
    expect(publish).not.toHaveBeenCalled()
    expect(syncFromWhatsapp).not.toHaveBeenCalled()
  })
})

describe("SyncWhatsAppHistoryUseCase.syncRadarFromHistory", () => {
  it("chama syncFromWhatsapp com since", async () => {
    const syncFromWhatsapp = mock(async () => ({
      created: 0,
      enriched: 1,
      skipped: 0,
      deferred: 0,
      errors: [] as string[],
    }))
    const useCase = new SyncWhatsAppHistoryUseCase({ syncFromWhatsapp })
    const result = await useCase.syncRadarFromHistory({
      teamId: "team-1",
      since: "2026-07-15T00:00:00.000Z",
    })
    expect(result.isValid).toBe(true)
    expect(syncFromWhatsapp).toHaveBeenCalledWith("team-1", {
      since: new Date("2026-07-15T00:00:00.000Z"),
    })
  })
})
