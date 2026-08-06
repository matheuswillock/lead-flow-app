import { describe, expect, it } from "bun:test"
import {
  normalizeOpenWaWebhookEvent,
  type NormalizedOpenWaEvent,
} from "./openwa-event-normalize"

describe("normalizeOpenWaWebhookEvent", () => {
  it("normaliza evento qr", () => {
    const result = normalizeOpenWaWebhookEvent({
      instance: "team_a",
      event: "qr",
      data: { qr: "QRDATA" },
      timestamp: 1,
    })
    expect(result).toEqual({
      kind: "qr",
      instance: "team_a",
      qr: "QRDATA",
    } satisfies NormalizedOpenWaEvent)
  })

  it("normaliza ready / disconnected", () => {
    expect(
      normalizeOpenWaWebhookEvent({
        instance: "i",
        event: "ready",
        data: {},
        timestamp: 1,
      })
    ).toMatchObject({ kind: "ready", instance: "i" })

    expect(
      normalizeOpenWaWebhookEvent({
        instance: "i",
        event: "disconnected",
        data: { reason: "LOGOUT" },
        timestamp: 1,
      })
    ).toMatchObject({ kind: "disconnected", reason: "LOGOUT" })
  })

  it("normaliza message inbound", () => {
    const result = normalizeOpenWaWebhookEvent({
      instance: "i",
      event: "message",
      data: {
        id: { _serialized: "true_5511999999999@c.us_ABCDEF" },
        from: "5511999999999@c.us",
        to: "me",
        body: "Olá",
        fromMe: false,
        timestamp: 1700000000,
        hasMedia: false,
        notifyName: "João",
      },
      timestamp: 1,
    })
    expect(result.kind).toBe("message")
    if (result.kind === "message") {
      expect(result.providerMessageId).toBe("true_5511999999999@c.us_ABCDEF")
      expect(result.remoteJid).toBe("5511999999999@c.us")
      expect(result.body).toBe("Olá")
      expect(result.fromMe).toBe(false)
      expect(result.pushName).toBe("João")
    }
  })

  it("normaliza message_ack", () => {
    const result = normalizeOpenWaWebhookEvent({
      instance: "i",
      event: "message_ack",
      data: { id: "msg-1", ack: 3 },
      timestamp: 1,
    })
    expect(result).toMatchObject({ kind: "message_ack", providerMessageId: "msg-1", ack: 3 })
  })

  it("retorna invalid para payload malformado", () => {
    expect(normalizeOpenWaWebhookEvent(null).kind).toBe("invalid")
    expect(normalizeOpenWaWebhookEvent({ event: "unknown" }).kind).toBe("invalid")
  })
})
