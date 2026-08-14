import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishRadarPixelEvent,
  buildRadarPixelEventIdempotencyKey,
  RADAR_PIXEL_EVENTS_TOPIC,
  RADAR_PIXEL_EVENTS_RETENTION_SECONDS,
} = await import("./radar-pixel-events")

describe("publishRadarPixelEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey por dia UTC", async () => {
    const payload = {
      teamId: "team-1",
      publicToken: "tok-1",
      eventType: "pixel.pageview",
      visitorSession: "vs-1",
      origin: "https://exemplo.com",
      userAgent: "test-agent",
    }
    const result = await publishRadarPixelEvent(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RADAR_PIXEL_EVENTS_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2].retentionSeconds).toBe(RADAR_PIXEL_EVENTS_RETENTION_SECONDS)
    expect(call[2].idempotencyKey).toBe(
      buildRadarPixelEventIdempotencyKey(payload)
    )
    expect(call[2].idempotencyKey).toMatch(/^team-1:vs-1:pixel\.pageview:\d{4}-\d{2}-\d{2}$/)
  })
})

describe("buildRadarPixelEventIdempotencyKey", () => {
  it("usa YYYY-MM-DD UTC", () => {
    expect(
      buildRadarPixelEventIdempotencyKey(
        { teamId: "t1", visitorSession: "vs", eventType: "pixel.click" },
        new Date("2026-08-14T23:30:00.000Z")
      )
    ).toBe("t1:vs:pixel.click:2026-08-14")
  })
})
