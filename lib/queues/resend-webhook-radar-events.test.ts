import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishResendWebhookRadarEvent,
  buildResendWebhookRadarEventIdempotencyKey,
  RESEND_WEBHOOK_RADAR_EVENTS_TOPIC,
  RESEND_WEBHOOK_RADAR_EVENTS_RETENTION_SECONDS,
} = await import("./resend-webhook-radar-events")

const basePayload = {
  teamId: "22222222-2222-4222-8222-222222222222",
  recipientEmail: "lead@test.com",
  recipientName: "Lead",
  logId: "log-1",
  campaignId: "camp-1",
  eventType: "opened" as const,
  occurredAt: "2026-08-13T12:00:00.000Z",
  metadata: {},
}

describe("publishResendWebhookRadarEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey = svixId e retenção de 7 dias", async () => {
    const payload = { ...basePayload, svixId: "svix-abc" }
    const result = await publishResendWebhookRadarEvent(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RESEND_WEBHOOK_RADAR_EVENTS_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2]).toEqual({
      idempotencyKey: "svix-abc",
      retentionSeconds: RESEND_WEBHOOK_RADAR_EVENTS_RETENTION_SECONDS,
    })
  })

  it("usa orphan:${emailOrphanEventId} quando não há svixId", async () => {
    const payload = { ...basePayload, emailOrphanEventId: "orphan-9" }
    await publishResendWebhookRadarEvent(payload)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[2].idempotencyKey).toBe("orphan:orphan-9")
  })
})

describe("buildResendWebhookRadarEventIdempotencyKey", () => {
  it("prioriza svixId", () => {
    expect(
      buildResendWebhookRadarEventIdempotencyKey({
        svixId: "svix-1",
        emailOrphanEventId: "orphan-1",
        logId: "log-1",
        eventType: "opened",
        occurredAt: "2026-08-13T12:00:00.000Z",
      })
    ).toBe("svix-1")
  })

  it("usa orphan:${id} sem svixId", () => {
    expect(
      buildResendWebhookRadarEventIdempotencyKey({
        svixId: null,
        emailOrphanEventId: "orphan-2",
        logId: "log-1",
        eventType: "opened",
        occurredAt: "2026-08-13T12:00:00.000Z",
      })
    ).toBe("orphan:orphan-2")
  })

  it("sintetiza chave por log quando não há svixId nem orphan", () => {
    expect(
      buildResendWebhookRadarEventIdempotencyKey({
        logId: "log-1",
        eventType: "opened",
        occurredAt: "2026-08-13T12:00:00.000Z",
      })
    ).toBe("log:log-1:opened:2026-08-13T12:00:00.000Z")
  })
})
