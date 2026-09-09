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

const { consumeBillingRateLimit, BILLING_RATE_LIMIT_RETENTION_MS } = await import(
  "./billing-rate-limit"
)

describe("consumeBillingRateLimit", () => {
  it("permite quando o UPSERT retorna uma linha (dentro do teto)", async () => {
    queryRawMock.mockResolvedValueOnce([{ count: 1 }])

    const result = await consumeBillingRateLimit("ip:1.2.3.4", { limit: 10, windowMs: 60_000 })

    expect(result.allowed).toBe(true)
  })

  it("bloqueia quando o UPSERT não incrementa (teto estourado) e devolve retryAfterSeconds > 0", async () => {
    queryRawMock.mockResolvedValueOnce([])

    const result = await consumeBillingRateLimit("ip:1.2.3.4", { limit: 10, windowMs: 60_000 })

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("todo consumo limpa janelas expiradas na mesma operação (retenção — achado codex PR #1134)", async () => {
    lastQuery = null
    const now = new Date("2026-09-09T12:00:00Z")

    await consumeBillingRateLimit("ip:1.2.3.4", { limit: 10, windowMs: 60_000 }, now)

    expect(lastQuery).not.toBeNull()
    expect(lastQuery!.sql).toContain("delete from billing_rate_limit_windows")
    const expectedCutoff = new Date(now.getTime() - BILLING_RATE_LIMIT_RETENTION_MS)
    const cutoffParam = lastQuery!.values.find(
      (v) => v instanceof Date && v.getTime() === expectedCutoff.getTime()
    )
    expect(cutoffParam).toBeInstanceOf(Date)
  })
})
