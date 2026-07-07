import { describe, expect, it, mock } from "bun:test"

const createIdempotentLeadActivity = mock(async () => ({ id: "activity-1" }))

mock.module("@/lib/lead-activities/createIdempotentLeadActivity", () => ({
  createIdempotentLeadActivity,
}))

const {
  buildConversationMilestoneSourceKey,
  shouldRecordConversationReopened,
  WhatsAppLeadActivityService,
} = await import("./WhatsAppLeadActivityService")

describe("WhatsAppLeadActivityService", () => {
  it("gera sourceKey estável para conversation_started", () => {
    expect(buildConversationMilestoneSourceKey("conversation_started", "conv-1")).toBe(
      "whatsapp:conversation_started:conv-1"
    )
  })

  it("inclui data no sourceKey de conversation_reopened", () => {
    const reopenedAt = new Date("2026-07-06T15:30:00.000Z")
    expect(
      buildConversationMilestoneSourceKey("conversation_reopened", "conv-1", reopenedAt)
    ).toBe("whatsapp:conversation_reopened:conv-1:2026-07-06")
  })

  it("só marca reopened após 7 dias de silêncio", () => {
    const now = new Date("2026-07-08T12:00:00.000Z")
    const recent = new Date("2026-07-07T12:00:00.000Z")
    const stale = new Date("2026-06-30T12:00:00.000Z")

    expect(shouldRecordConversationReopened(null, now)).toBe(false)
    expect(shouldRecordConversationReopened(recent, now)).toBe(false)
    expect(shouldRecordConversationReopened(stale, now)).toBe(true)
  })

  it("chama createIdempotentLeadActivity com payload de marco", async () => {
    createIdempotentLeadActivity.mockClear()
    const service = new WhatsAppLeadActivityService()

    await service.recordConversationMilestone({
      teamId: "team-1",
      leadId: "lead-1",
      conversationId: "conv-1",
      milestone: "conversation_started",
      preview: "Olá",
    })

    expect(createIdempotentLeadActivity).toHaveBeenCalledTimes(1)
    expect(createIdempotentLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        type: "whatsapp",
        body: "Conversa de WhatsApp iniciada",
        sourceKey: "whatsapp:conversation_started:conv-1",
        payload: expect.objectContaining({
          conversationId: "conv-1",
          milestone: "conversation_started",
          preview: "Olá",
        }),
      })
    )
  })
})
