import { describe, expect, it, mock } from "bun:test"

let lastQuery: { sql: string; values: unknown[] } | null = null

const queryRawMock = mock(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  lastQuery = { sql: strings.join("?"), values }
  return [{ count: 1 }]
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

const {
  consumeInboundRateLimit,
  buildInboundWebhookIpKey,
  buildInboundWebhookBadTokenKey,
  buildInboundWebhookKeyForWindow,
  buildInboundWebhookTeamKey,
  checkInboundWebhookLayerRateLimit,
  INBOUND_WEBHOOK_RATE_LIMITS,
  INBOUND_WEBHOOK_RATE_LIMIT_RETENTION_MS,
} = await import("./inbound-rate-limit")

describe("consumeInboundRateLimit (T-10.9, T-10.10, T-10.11 — base)", () => {
  it("permite quando o UPSERT retorna uma linha (dentro do teto)", async () => {
    queryRawMock.mockResolvedValueOnce([{ count: 1 }])

    const result = await consumeInboundRateLimit("wh-in:ip:1.2.3.4", { limit: 120, windowMs: 60_000 })

    expect(result.allowed).toBe(true)
  })

  it("bloqueia quando o UPSERT não incrementa (teto estourado) e devolve retryAfterSeconds > 0", async () => {
    queryRawMock.mockResolvedValueOnce([])

    const result = await consumeInboundRateLimit("wh-in:ip:1.2.3.4", { limit: 120, windowMs: 60_000 })

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("todo consumo limpa janelas expiradas na mesma operação (retenção)", async () => {
    lastQuery = null
    const now = new Date("2026-09-21T12:00:00Z")

    await consumeInboundRateLimit("wh-in:ip:1.2.3.4", { limit: 120, windowMs: 60_000 }, now)

    expect(lastQuery).not.toBeNull()
    expect(lastQuery!.sql.toLowerCase()).toContain("delete from")
    expect(lastQuery!.sql.toLowerCase()).toContain("webhooks_inbound_rate_limit_windows")
    const expectedCutoff = new Date(now.getTime() - INBOUND_WEBHOOK_RATE_LIMIT_RETENTION_MS)
    const cutoffParam = lastQuery!.values.find(
      (v) => v instanceof Date && v.getTime() === expectedCutoff.getTime()
    )
    expect(cutoffParam).toBeInstanceOf(Date)
  })

  it("T-10.11 — banco indisponível falha fechado (nega em vez de liberar)", async () => {
    queryRawMock.mockImplementationOnce(async () => {
      throw new Error("connection lost")
    })

    const result = await consumeInboundRateLimit("wh-in:ip:9.9.9.9", { limit: 120, windowMs: 60_000 })

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe("chaves das 4 camadas (DA3)", () => {
  it("monta as chaves no formato da SPEC", () => {
    expect(buildInboundWebhookIpKey("1.2.3.4")).toBe("wh-in:ip:1.2.3.4")
    expect(buildInboundWebhookBadTokenKey("team-1", "1.2.3.4")).toBe("wh-in:badtoken:team-1:1.2.3.4")
    expect(buildInboundWebhookTeamKey("team-1")).toBe("wh-in:team:team-1")
    expect(buildInboundWebhookKeyForWindow("wh-1", "1m")).toBe("wh-in:wh:wh-1:1m")
    expect(buildInboundWebhookKeyForWindow("wh-1", "1h")).toBe("wh-in:wh:wh-1:1h")
  })

  it("limites batem com a tabela da SPEC (IP 120/min, badtoken 20/5min, webhook 60/min e 1000/h, time 300/min)", () => {
    expect(INBOUND_WEBHOOK_RATE_LIMITS.ip).toEqual({ limit: 120, windowMs: 60_000 })
    expect(INBOUND_WEBHOOK_RATE_LIMITS.badToken).toEqual({ limit: 20, windowMs: 5 * 60_000 })
    expect(INBOUND_WEBHOOK_RATE_LIMITS.webhookPerMinute).toEqual({ limit: 60, windowMs: 60_000 })
    expect(INBOUND_WEBHOOK_RATE_LIMITS.webhookPerHour).toEqual({ limit: 1000, windowMs: 60 * 60_000 })
    expect(INBOUND_WEBHOOK_RATE_LIMITS.team).toEqual({ limit: 300, windowMs: 60_000 })
  })
})

describe("checkInboundWebhookLayerRateLimit — camada do webhook combina 60/min e 1000/h", () => {
  it("recusa quando a janela por minuto estoura, mesmo com a janela por hora livre", async () => {
    queryRawMock.mockReset()
    queryRawMock.mockImplementationOnce(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      lastQuery = { sql: strings.join("?"), values }
      return []
    })
    queryRawMock.mockImplementationOnce(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      lastQuery = { sql: strings.join("?"), values }
      return [{ count: 1 }]
    })

    const result = await checkInboundWebhookLayerRateLimit("wh-1")

    expect(result.allowed).toBe(false)
  })

  it("permite quando as duas janelas (minuto e hora) estão dentro do teto", async () => {
    queryRawMock.mockReset()
    queryRawMock.mockResolvedValue([{ count: 1 }])

    const result = await checkInboundWebhookLayerRateLimit("wh-1")

    expect(result.allowed).toBe(true)
  })

  it("R10-11 — só a janela de 1 min estourou → retryAfter reflete o minuto, não a hora (até 3600s)", async () => {
    // now escolhido logo no início de uma janela de hora (para o "tempo até
    // o fim da janela de hora" ficar perto do máximo, ~3600s) e perto do
    // fim de uma janela de minuto (retryAfter do minuto pequeno, ~1-2s).
    // Antes da correção, `consumeInboundRateLimit` calculava
    // `retryAfterSeconds` incondicionalmente (mesmo quando `allowed: true`),
    // e `checkInboundWebhookLayerRateLimit` fazia `Math.max` das duas —
    // devolvendo o "tempo até o fim da janela de hora" mesmo quando só a
    // janela de minuto estourou.
    const now = new Date("2026-01-01T00:00:59.000Z") // 1s antes do fim do minuto, início da hora
    queryRawMock.mockReset()
    queryRawMock.mockImplementationOnce(async () => []) // janela de minuto: estourou
    queryRawMock.mockImplementationOnce(async () => [{ count: 1 }]) // janela de hora: livre

    const result = await checkInboundWebhookLayerRateLimit("wh-1", now)

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(2)
  })
})
