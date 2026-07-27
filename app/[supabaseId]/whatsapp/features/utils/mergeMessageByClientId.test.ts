import { describe, expect, it } from "bun:test"
import { mergeMessageByClientId } from "./mergeMessageByClientId"
import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"

function msg(partial: Partial<WhatsAppMessage> & Pick<WhatsAppMessage, "id">): WhatsAppMessage {
  return {
    conversationId: "c1",
    direction: "OUTBOUND",
    messageType: "TEXT",
    status: "PENDING",
    clientMessageId: null,
    contentText: "oi",
    mediaUrl: null,
    caption: null,
    senderDisplayName: null,
    mediaFileName: null,
    linkPreview: null,
    sentByProfileId: null,
    senderPhone: null,
    recipientPhone: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    isAutoResponse: false,
    createdAt: "2026-07-27T00:00:00.000Z",
    ...partial,
  }
}

describe("mergeMessageByClientId", () => {
  it("promove bolha otimista pelo clientMessageId", () => {
    const clientMessageId = "11111111-1111-4111-8111-111111111111"
    const prev = [msg({ id: "optimistic-1", clientMessageId, status: "PENDING" })]
    const next = mergeMessageByClientId(
      prev,
      msg({ id: "real-1", clientMessageId, status: "SENT" })
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe("real-1")
    expect(next[0]?.status).toBe("SENT")
    expect(next[0]?.clientMessageId).toBe(clientMessageId)
  })

  it("não duplica quando o id já existe", () => {
    const prev = [msg({ id: "real-1", clientMessageId: "aaa", status: "PENDING" })]
    const next = mergeMessageByClientId(
      prev,
      msg({ id: "real-1", clientMessageId: "aaa", status: "DELIVERED" })
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.status).toBe("DELIVERED")
  })

  it("anexa mensagem sem clientMessageId correspondente", () => {
    const prev = [msg({ id: "a", clientMessageId: "x" })]
    const next = mergeMessageByClientId(prev, msg({ id: "b", clientMessageId: "y" }))
    expect(next).toHaveLength(2)
  })
})
