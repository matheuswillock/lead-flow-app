import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishEmailCampaignDispatchWake,
  publishEmailCampaignDispatchOverflowWake,
  buildEmailCampaignDispatchIdempotencyKey,
  EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC,
  EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
} = await import("./email-campaign-dispatch")

describe("buildEmailCampaignDispatchIdempotencyKey", () => {
  it("usa dispatchId:reason para start/cron-start/cron-reclaim", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "start" })
    ).toBe("d1:start")
    expect(
      buildEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "cron-reclaim" })
    ).toBe("d1:cron-reclaim")
  })

  it("usa dispatchId:continue:remainingCount para reason continue", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 42,
      })
    ).toBe("d1:continue:42")
  })
})

describe("publishEmailCampaignDispatchWake", () => {
  beforeEach(() => {
    send.mockClear()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("publica no tópico principal", async () => {
    await publishEmailCampaignDispatchWake({ dispatchId: "d1", reason: "continue", remainingCount: 10 })
    expect(send).toHaveBeenCalledWith(
      EMAIL_CAMPAIGN_DISPATCH_TOPIC,
      expect.objectContaining({ dispatchId: "d1", reason: "continue" }),
      expect.objectContaining({
        idempotencyKey: "d1:continue:10",
        retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
      })
    )
  })

  it("publica no tópico overflow", async () => {
    await publishEmailCampaignDispatchOverflowWake({
      dispatchId: "d1",
      reason: "cron-reclaim",
      remainingCount: 59_146,
    })
    expect(send).toHaveBeenCalledWith(
      EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC,
      expect.objectContaining({ dispatchId: "d1", reason: "cron-reclaim" }),
      expect.objectContaining({
        idempotencyKey: "d1:cron-reclaim",
        retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
      })
    )
  })
})
