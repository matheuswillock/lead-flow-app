import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"
import type { ResendWebhookEmailLogEventPayload } from "@/lib/queues/resend-webhook-emaillog-events"

mock.module("@/lib/queues/resend-webhook-emaillog-events", () => ({
  handleResendWebhookEmailLogEventsCallback: (
    handler: (
      message: ResendWebhookEmailLogEventPayload,
      metadata: QueueMessageMetadata
    ) => Promise<void>
  ) => handler,
  publishResendWebhookEmailLogEvent: mock(async () => ({ messageId: "mid-test" })),
  RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC: "resend-webhook-emaillog-events",
  RESEND_WEBHOOK_EMAILLOG_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
}))

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

const { processResendWebhookEmailLogEventMessage } = await import("./route")

const handle = mock(async () => new Output(true, [], [], { handled: true }))

const baseEvent = (): ResendWebhookPayload => ({
  type: "email.delivered",
  data: {
    email_id: "email-1",
    created_at: "2026-08-13T12:00:00.000Z",
    to: ["lead@test.com"],
  },
})

const baseMessage = (): ResendWebhookEmailLogEventPayload => ({
  event: baseEvent(),
  svixId: "svix-1",
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "resend-webhook-emaillog-events",
  region: "gru1",
}

describe("processResendWebhookEmailLogEventMessage", () => {
  beforeEach(() => {
    handle.mockReset()
    handle.mockResolvedValue(new Output(true, [], [], { handled: true }))
  })

  it("chama handle com event e svixId", async () => {
    const message = baseMessage()
    await processResendWebhookEmailLogEventMessage(message, metadata, { handle })
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith({
      event: message.event,
      svixId: "svix-1",
    })
  })

  it("output.isValid === false: lança erro para retry do handleCallback", async () => {
    handle.mockResolvedValueOnce(
      new Output(false, [], ["persist failed"], null)
    )
    await expect(
      processResendWebhookEmailLogEventMessage(baseMessage(), metadata, { handle })
    ).rejects.toThrow("persist failed")
    expect(handle).toHaveBeenCalledTimes(1)
  })

  it("payload inválido: ack sem chamar handle", async () => {
    await processResendWebhookEmailLogEventMessage(
      { ...baseMessage(), svixId: "" },
      metadata,
      { handle }
    )
    expect(handle).not.toHaveBeenCalled()
  })

  it("payload sem event: ack sem chamar handle", async () => {
    await processResendWebhookEmailLogEventMessage(
      { svixId: "svix-1" } as ResendWebhookEmailLogEventPayload,
      metadata,
      { handle }
    )
    expect(handle).not.toHaveBeenCalled()
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    handle.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processResendWebhookEmailLogEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        { handle }
      )
    ).rejects.toThrow("P2024")
  })
})
