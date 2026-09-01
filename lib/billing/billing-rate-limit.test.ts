import { describe, expect, it, mock } from "bun:test"

const queryRawMock = mock(async () => [{ count: 1 }])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

const { consumeBillingRateLimit } = await import("./billing-rate-limit")

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
})
