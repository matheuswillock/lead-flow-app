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
  it("mantém dispatchId:reason estável para start (protege contra duplo clique)", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "start" })
    ).toBe("d1:start")
    expect(
      buildEmailCampaignDispatchIdempotencyKey({ dispatchId: "d1", reason: "start" })
    ).toBe("d1:start")
  })

  it("usa dispatchId:continue:remainingCount quando não há batchOffset (legado)", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 42,
      })
    ).toBe("d1:continue:42")
  })

  it("prefere batchOffset a remainingCount no continue", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 500,
        batchOffset: 1500,
      })
    ).toBe("d1:continue:1500")
  })

  it("aceita batchOffset 0 como discriminador válido (primeiro lote)", () => {
    expect(
      buildEmailCampaignDispatchIdempotencyKey({
        dispatchId: "d1",
        reason: "continue",
        remainingCount: 500,
        batchOffset: 0,
      })
    ).toBe("d1:continue:0")
  })

  /**
   * Regressão do incidente de produção: quando o lote esvaziava a fila mas
   * ainda havia audiência a materializar, `remainingCount` era sempre
   * `batchSize` (500). A chave repetida caía na janela de dedupe de 24h da
   * Vercel Queue e o disparo travava. `batchOffset` avança a cada lote.
   */
  it("gera chaves distintas para lotes consecutivos com o mesmo remainingCount", () => {
    const first = buildEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "continue",
      remainingCount: 500,
      batchOffset: 1000,
    })
    const second = buildEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "continue",
      remainingCount: 500,
      batchOffset: 1500,
    })

    expect(first).not.toBe(second)
  })

  /**
   * Regressão da inanição de recuperação: com chave constante, o cron (a cada
   * 5 min) só conseguia acordar um dispatch parado uma vez por dia.
   */
  it("gera chaves distintas para cron-reclaim em buckets diferentes", () => {
    const first = buildEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "cron-reclaim",
      wakeBucket: 100,
    })
    const second = buildEmailCampaignDispatchIdempotencyKey({
      dispatchId: "d1",
      reason: "cron-reclaim",
      wakeBucket: 101,
    })

    expect(first).toBe("d1:cron-reclaim:100")
    expect(second).toBe("d1:cron-reclaim:101")
  })

  it("deduplica cron-start dentro do mesmo bucket", () => {
    const payload = { dispatchId: "d1", reason: "cron-start" as const, wakeBucket: 100 }

    expect(buildEmailCampaignDispatchIdempotencyKey(payload)).toBe(
      buildEmailCampaignDispatchIdempotencyKey(payload)
    )
  })

  /**
   * O dead-letter recalcula a chave a partir do payload que chegou ao consumer
   * (`processDispatchMessage`), e o republish reenvia com essa chave. Só fecha
   * se a chave for função pura do payload — daí `wakeBucket` viajar na
   * mensagem em vez de ser recalculado no consumo.
   */
  it("é reproduzível a partir do payload serializado (dead-letter)", () => {
    const published = {
      dispatchId: "d1",
      reason: "cron-reclaim" as const,
      wakeBucket: 100,
    }
    const received = JSON.parse(JSON.stringify(published))

    expect(buildEmailCampaignDispatchIdempotencyKey(received)).toBe(
      buildEmailCampaignDispatchIdempotencyKey(published)
    )
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
      wakeBucket: 100,
    })
    expect(send).toHaveBeenCalledWith(
      EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC,
      expect.objectContaining({ dispatchId: "d1", reason: "cron-reclaim" }),
      expect.objectContaining({
        idempotencyKey: "d1:cron-reclaim:100",
        retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
      })
    )
  })

  it("respeita idempotencyKey explícita (recuperação manual e republish)", async () => {
    await publishEmailCampaignDispatchWake(
      { dispatchId: "d1", reason: "cron-reclaim", wakeBucket: 100 },
      { idempotencyKey: "d1:manual-recovery:1755800000000" }
    )
    expect(send).toHaveBeenCalledWith(
      EMAIL_CAMPAIGN_DISPATCH_TOPIC,
      expect.objectContaining({ dispatchId: "d1" }),
      expect.objectContaining({ idempotencyKey: "d1:manual-recovery:1755800000000" })
    )
  })
})
