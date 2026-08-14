import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import { ProcessWhatsappRadarEventUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsappRadarEventUseCase"

describe("ProcessWhatsappRadarEventUseCase", () => {
  const findMessageByIdForTeam = mock(async () => ({
    id: "msg-1",
    conversationId: "conv-1",
  }))
  const findConversationById = mock(async () => ({ id: "conv-1" }))
  const syncMessage = { execute: mock(async () => new Output(true, [], [], { synced: true })) }
  const syncHistory = {
    syncRadarFromHistory: mock(async () => new Output(true, [], [], { ok: true })),
  }

  beforeEach(() => {
    findMessageByIdForTeam.mockClear()
    findMessageByIdForTeam.mockImplementation(async () => ({
      id: "msg-1",
      conversationId: "conv-1",
    }))
    findConversationById.mockClear()
    findConversationById.mockImplementation(async () => ({ id: "conv-1" }))
    syncMessage.execute.mockClear()
    syncMessage.execute.mockResolvedValue(new Output(true, [], [], { synced: true }))
    syncHistory.syncRadarFromHistory.mockClear()
    syncHistory.syncRadarFromHistory.mockResolvedValue(new Output(true, [], [], { ok: true }))
  })

  const useCase = () =>
    new ProcessWhatsappRadarEventUseCase({
      repository: { findMessageByIdForTeam, findConversationById },
      syncMessage,
      syncHistory,
    } as unknown as ConstructorParameters<typeof ProcessWhatsappRadarEventUseCase>[0])

  it("message carrega mensagem+conversa e chama SyncWhatsappMessageToRadar", async () => {
    const result = await useCase().execute({
      source: "message",
      teamId: "team-1",
      messageId: "msg-1",
    })
    expect(result.isValid).toBe(true)
    expect(syncMessage.execute).toHaveBeenCalledTimes(1)
    expect(syncHistory.syncRadarFromHistory).not.toHaveBeenCalled()
  })

  it("history chama syncRadarFromHistory", async () => {
    await useCase().execute({
      source: "history",
      teamId: "team-1",
      since: "2026-07-15T00:00:00.000Z",
    })
    expect(syncHistory.syncRadarFromHistory).toHaveBeenCalledWith({
      teamId: "team-1",
      since: "2026-07-15T00:00:00.000Z",
    })
    expect(syncMessage.execute).not.toHaveBeenCalled()
  })
})
