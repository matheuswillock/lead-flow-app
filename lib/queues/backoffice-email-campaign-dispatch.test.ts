import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishBackofficeEmailCampaignDispatchWake,
  buildBackofficeEmailCampaignDispatchIdempotencyKey,
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
} = await import("./backoffice-email-campaign-dispatch")

describe("buildBackofficeEmailCampaignDispatchIdempotencyKey", () => {
  it("usa dispatchId:reason para start/cron-start/cron-reclaim", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "start" })
    ).toBe("d1:start")
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "cron-start" })
    ).toBe("d1:cron-start")
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "cron-reclaim" })
    ).toBe("d1:cron-reclaim")
  })

  it("usa dispatchId:continue:remainingCount para reason continue", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 42,
      })
    ).toBe("d1:continue:42")
  })

  it("usa 0 como fallback quando remainingCount não é informado no reason continue", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "continue" })
    ).toBe("d1:continue:0")
  })
})

describe("publishBackofficeEmailCampaignDispatchWake", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey e retenção de 7 dias", async () => {
    const result = await publishBackofficeEmailCampaignDispatchWake({
      dispatchId: "dispatch-1",
      reason: "start",
    })

    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      { dispatchId: string; reason: string },
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC)
    expect(call[1]).toEqual({ dispatchId: "dispatch-1", reason: "start" })
    expect(call[2]).toEqual({
      idempotencyKey: "dispatch-1:start",
      retentionSeconds: BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
    })
  })

  it("propaga remainingCount no payload e na idempotencyKey quando reason=continue", async () => {
    await publishBackofficeEmailCampaignDispatchWake({
      dispatchId: "dispatch-1",
      reason: "continue",
      remainingCount: 10,
    })

    const call = send.mock.calls[0] as unknown as [
      string,
      { dispatchId: string; reason: string; remainingCount?: number },
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[1]).toEqual({ dispatchId: "dispatch-1", reason: "continue", remainingCount: 10 })
    expect(call[2].idempotencyKey).toBe("dispatch-1:continue:10")
  })
})
