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
    mentionedJids: null,
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

  it("preserva mediaUrl/recibos quando HTTP chega com nulls após Realtime", () => {
    const clientMessageId = "22222222-2222-4222-8222-222222222222"
    const prev = [
      msg({
        id: "real-1",
        clientMessageId,
        status: "DELIVERED",
        mediaUrl: "https://cdn.example/a.jpg",
        deliveredAt: "2026-07-27T00:01:00.000Z",
        mediaFileName: "a.jpg",
      }),
    ]
    const next = mergeMessageByClientId(
      prev,
      msg({
        id: "real-1",
        clientMessageId,
        status: "SENT",
        mediaUrl: null,
        mediaFileName: null,
        deliveredAt: null,
      })
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.mediaUrl).toBe("https://cdn.example/a.jpg")
    expect(next[0]?.mediaFileName).toBe("a.jpg")
    expect(next[0]?.deliveredAt).toBe("2026-07-27T00:01:00.000Z")
    expect(next[0]?.status).toBe("DELIVERED")
  })

  it("anexa mensagem sem clientMessageId correspondente", () => {
    const prev = [msg({ id: "a", clientMessageId: "x" })]
    const next = mergeMessageByClientId(prev, msg({ id: "b", clientMessageId: "y" }))
    expect(next).toHaveLength(2)
  })
})
