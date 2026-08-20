import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { ResendWebhookRadarEventPayload } from "@/lib/queues/resend-webhook-radar-events"

mock.module("@/lib/queues/resend-webhook-radar-events", () => ({
  handleResendWebhookRadarEventsCallback: (
    handler: (
      message: ResendWebhookRadarEventPayload,
      metadata: QueueMessageMetadata
    ) => Promise<void>
  ) => handler,
  publishResendWebhookRadarEvent: mock(async () => ({ messageId: "mid-test" })),
  RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG: "resend_webhook_radar_queue_publish_failed",
  RESEND_WEBHOOK_RADAR_EVENTS_TOPIC: "resend-webhook-radar-events",
  RESEND_WEBHOOK_RADAR_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildResendWebhookRadarEventIdempotencyKey: (payload: { svixId?: string | null }) =>
    payload.svixId ?? "orphan:x",
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

const { processResendWebhookRadarEventMessage } = await import("./route")

const handleRadarQueueEvent = mock(async () => {})

const baseMessage = (): ResendWebhookRadarEventPayload => ({
  teamId: "22222222-2222-4222-8222-222222222222",
  recipientEmail: "lead@test.com",
  recipientName: "Lead",
  logId: "log-1",
  campaignId: "camp-1",
  eventType: "opened",
  occurredAt: "2026-08-13T12:00:00.000Z",
  metadata: { link: "https://example.com" },
  svixId: "svix-1",
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "resend-webhook-radar-events",
  region: "gru1",
}

describe("processResendWebhookRadarEventMessage", () => {
  beforeEach(() => {
    handleRadarQueueEvent.mockReset()
    handleRadarQueueEvent.mockResolvedValue(undefined)
  })

  it("chama handleRadarQueueEvent com occurredAt como Date", async () => {
    await processResendWebhookRadarEventMessage(baseMessage(), metadata, {
      handleRadarQueueEvent,
    })
    expect(handleRadarQueueEvent).toHaveBeenCalledTimes(1)
    expect(handleRadarQueueEvent).toHaveBeenCalledWith({
      teamId: "22222222-2222-4222-8222-222222222222",
      recipientEmail: "lead@test.com",
      recipientName: "Lead",
      logId: "log-1",
      campaignId: "camp-1",
      eventType: "opened",
      occurredAt: new Date("2026-08-13T12:00:00.000Z"),
      metadata: { link: "https://example.com" },
    })
  })

  it("payload inválido: ack sem chamar handleRadarQueueEvent", async () => {
    await processResendWebhookRadarEventMessage(
      { ...baseMessage(), logId: "" },
      metadata,
      { handleRadarQueueEvent }
    )
    expect(handleRadarQueueEvent).not.toHaveBeenCalled()
  })

  it("occurredAt inválido: ack sem chamar handleRadarQueueEvent", async () => {
    await processResendWebhookRadarEventMessage(
      { ...baseMessage(), occurredAt: "not-a-date" },
      metadata,
      { handleRadarQueueEvent }
    )
    expect(handleRadarQueueEvent).not.toHaveBeenCalled()
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    handleRadarQueueEvent.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processResendWebhookRadarEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        { handleRadarQueueEvent }
      )
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    handleRadarQueueEvent.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processResendWebhookRadarEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { handleRadarQueueEvent },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "resend-webhook-radar-events",
        deliveryCount: 20,
      }),
    )
  })
})
