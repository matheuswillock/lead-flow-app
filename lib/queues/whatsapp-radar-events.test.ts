import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishWhatsappRadarEvent,
  buildWhatsappRadarEventIdempotencyKey,
  WHATSAPP_RADAR_EVENTS_TOPIC,
  WHATSAPP_RADAR_EVENTS_RETENTION_SECONDS,
} = await import("./whatsapp-radar-events")

describe("publishWhatsappRadarEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("mensagem usa teamId:messageId", async () => {
    const payload = { source: "message" as const, teamId: "team-1", messageId: "msg-9" }
    await publishWhatsappRadarEvent(payload)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(WHATSAPP_RADAR_EVENTS_TOPIC)
    expect(call[2]).toEqual({
      idempotencyKey: "team-1:msg-9",
      retentionSeconds: WHATSAPP_RADAR_EVENTS_RETENTION_SECONDS,
    })
  })
})

describe("buildWhatsappRadarEventIdempotencyKey", () => {
  it("history usa teamId:history:since", () => {
    expect(
      buildWhatsappRadarEventIdempotencyKey({
        source: "history",
        teamId: "t1",
        since: "2026-07-15T00:00:00.000Z",
      })
    ).toBe("t1:history:2026-07-15T00:00:00.000Z")
  })
})
