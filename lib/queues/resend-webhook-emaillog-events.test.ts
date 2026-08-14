import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishResendWebhookEmailLogEvent,
  RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC,
  RESEND_WEBHOOK_EMAILLOG_EVENTS_RETENTION_SECONDS,
} = await import("./resend-webhook-emaillog-events")

const baseEvent: ResendWebhookPayload = {
  type: "email.delivered",
  data: {
    email_id: "email-1",
    created_at: "2026-08-13T12:00:00.000Z",
    to: ["lead@test.com"],
  },
}

const basePayload = {
  event: baseEvent,
  svixId: "svix-abc",
}

describe("publishResendWebhookEmailLogEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com payload completo, idempotencyKey = svixId e retenção de 7 dias", async () => {
    const result = await publishResendWebhookEmailLogEvent(basePayload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof basePayload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC)
    expect(call[1]).toEqual(basePayload)
    expect(call[2]).toEqual({
      idempotencyKey: "svix-abc",
      retentionSeconds: RESEND_WEBHOOK_EMAILLOG_EVENTS_RETENTION_SECONDS,
    })
  })

  it("retorna { messageId } do resultado do send", async () => {
    send.mockResolvedValue({ messageId: "mid-queued" })
    const result = await publishResendWebhookEmailLogEvent(basePayload)
    expect(result).toEqual({ messageId: "mid-queued" })
  })
})
