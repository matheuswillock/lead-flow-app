import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { RadarPixelEventPayload } from "@/lib/queues/radar-pixel-events"

mock.module("@/lib/queues/radar-pixel-events", () => ({
  handleRadarPixelEventsCallback: (
    handler: (
      message: RadarPixelEventPayload,
      metadata: { messageId: string; deliveryCount: number }
    ) => Promise<void>
  ) => handler,
  publishRadarPixelEvent: mock(async () => ({ messageId: "mid-test" })),
  RADAR_PIXEL_EVENTS_QUEUE_PUBLISH_FAILED_TAG: "radar_pixel_events_queue_publish_failed",
  RADAR_PIXEL_EVENTS_TOPIC: "radar-pixel-events",
  RADAR_PIXEL_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildRadarPixelEventIdempotencyKey: () => "key",
  utcDayKey: () => "2026-08-14",
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processRadarPixelEventMessage } = await import("./route")

const persistQueuedHit = mock(async () => new Output(true, [], [], { status: "ok" }))

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "radar-pixel-events",
  region: "gru1",
}

const validMessage = (): RadarPixelEventPayload => ({
  teamId: "team-1",
  publicToken: "tok-1",
  eventType: "pixel.pageview",
  visitorSession: "vs-1",
  origin: null,
  userAgent: null,
})

describe("processRadarPixelEventMessage", () => {
  beforeEach(() => {
    persistQueuedHit.mockReset()
    persistQueuedHit.mockResolvedValue(new Output(true, [], [], { status: "ok" }))
  })

  it("chama persistQueuedHit com o payload", async () => {
    const message = validMessage()
    await processRadarPixelEventMessage(message, metadata, { persistQueuedHit })
    expect(persistQueuedHit).toHaveBeenCalledTimes(1)
    expect(persistQueuedHit).toHaveBeenCalledWith(message)
  })

  it("payload inválido: ack sem persistir", async () => {
    await processRadarPixelEventMessage(
      { ...validMessage(), teamId: "" },
      metadata,
      { persistQueuedHit }
    )
    expect(persistQueuedHit).not.toHaveBeenCalled()
  })

  it("!isValid: lança para retry", async () => {
    persistQueuedHit.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarPixelEventMessage(validMessage(), metadata, { persistQueuedHit })
    ).rejects.toThrow("falhou")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    persistQueuedHit.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarPixelEventMessage(
        validMessage(),
        { ...metadata, deliveryCount: 20 },
        { persistQueuedHit },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "radar-pixel-events",
        deliveryCount: 20,
      }),
    )
  })
})
