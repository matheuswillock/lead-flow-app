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
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_WAKE_RECOVERY_BUCKET_MS,
} = await import("./backoffice-email-campaign-dispatch")

describe("buildBackofficeEmailCampaignDispatchIdempotencyKey", () => {
  it("usa dispatchId:reason (chave estável) para start", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "start" })
    ).toBe("d1:start")
  })

  it("usa dispatchId:reason:wakeBucket para cron-start/cron-reclaim", () => {
    const now = new Date("2026-08-21T12:07:00.000Z")
    const bucket = Math.floor(now.getTime() / BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_WAKE_RECOVERY_BUCKET_MS)

    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey(
        { dispatchId: "d1", reason: "cron-start" },
        { now }
      )
    ).toBe(`d1:cron-start:${bucket}`)
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey(
        { dispatchId: "d1", reason: "cron-reclaim" },
        { now }
      )
    ).toBe(`d1:cron-reclaim:${bucket}`)
  })

  it("gera chaves distintas para cron-reclaim em janelas de 15 min diferentes", () => {
    const first = buildBackofficeEmailCampaignDispatchIdempotencyKey(
      { dispatchId: "d1", reason: "cron-reclaim" },
      { now: new Date("2026-08-21T12:00:00.000Z") }
    )
    const second = buildBackofficeEmailCampaignDispatchIdempotencyKey(
      { dispatchId: "d1", reason: "cron-reclaim" },
      { now: new Date("2026-08-21T12:15:00.000Z") }
    )

    expect(first).not.toBe(second)
  })

  it("mantém a mesma chave para cron-reclaim dentro da mesma janela de 15 min", () => {
    const first = buildBackofficeEmailCampaignDispatchIdempotencyKey(
      { dispatchId: "d1", reason: "cron-reclaim" },
      { now: new Date("2026-08-21T12:00:00.000Z") }
    )
    const second = buildBackofficeEmailCampaignDispatchIdempotencyKey(
      { dispatchId: "d1", reason: "cron-reclaim" },
      { now: new Date("2026-08-21T12:14:59.000Z") }
    )

    expect(first).toBe(second)
  })

  it("usa dispatchId:continue:batchOffset para reason continue", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        batchOffset: 500,
      })
    ).toBe("d1:continue:500")
  })

  it("gera chaves distintas para lotes consecutivos com o mesmo remainingCount quando batchOffset avança", () => {
    const first = buildBackofficeEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "continue",
      remainingCount: 4500,
      batchOffset: 500,
    })
    const second = buildBackofficeEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "continue",
      remainingCount: 4500,
      batchOffset: 1000,
    })

    expect(first).not.toBe(second)
  })

  it("usa remainingCount como fallback quando batchOffset não é informado no reason continue", () => {
    expect(
      buildBackofficeEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 42,
      })
    ).toBe("d1:continue:42")
  })

  it("usa 0 como fallback final quando nem batchOffset nem remainingCount são informados no reason continue", () => {
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

  it("prefere batchOffset a remainingCount na idempotencyKey quando reason=continue", async () => {
    await publishBackofficeEmailCampaignDispatchWake({
      dispatchId: "dispatch-1",
      reason: "continue",
      remainingCount: 4500,
      batchOffset: 500,
    })

    const call = send.mock.calls[0] as unknown as [
      string,
      unknown,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[2].idempotencyKey).toBe("dispatch-1:continue:500")
  })

  it("respeita options.now ao computar o wakeBucket de cron-reclaim", async () => {
    await publishBackofficeEmailCampaignDispatchWake(
      { dispatchId: "dispatch-1", reason: "cron-reclaim" },
      { now: new Date("2026-08-21T12:00:00.000Z") }
    )

    const bucket = Math.floor(
      new Date("2026-08-21T12:00:00.000Z").getTime() /
        BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_WAKE_RECOVERY_BUCKET_MS
    )
    const call = send.mock.calls[0] as unknown as [
      string,
      unknown,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[2].idempotencyKey).toBe(`dispatch-1:cron-reclaim:${bucket}`)
  })
})
