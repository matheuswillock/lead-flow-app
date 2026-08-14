import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishRadarEmailContactSyncWake,
  RADAR_EMAIL_CONTACT_SYNC_TOPIC,
  RADAR_EMAIL_CONTACT_SYNC_RETENTION_SECONDS,
  RADAR_EMAIL_CONTACT_SYNC_WAKE_IDEMPOTENCY_KEY,
} = await import("./radar-email-contact-sync")

describe("publishRadarEmailContactSyncWake", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia wake de lote com idempotencyKey coalescida e retenção de 7 dias", async () => {
    const result = await publishRadarEmailContactSyncWake()
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      { reason: string },
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RADAR_EMAIL_CONTACT_SYNC_TOPIC)
    expect(call[1]).toEqual({ reason: "outbox_due" })
    expect(call[2]).toEqual({
      idempotencyKey: RADAR_EMAIL_CONTACT_SYNC_WAKE_IDEMPOTENCY_KEY,
      retentionSeconds: RADAR_EMAIL_CONTACT_SYNC_RETENTION_SECONDS,
    })
  })
})
