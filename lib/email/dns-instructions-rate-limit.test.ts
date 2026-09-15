import { describe, expect, it, mock } from "bun:test"

/**
 * Mesmo padrão do lib/billing/billing-rate-limit.test.ts: prisma mockado no
 * módulo compartilhado, exercitando o wrapper real (chave por time, teto 5,
 * janela de 60min). O invariante de concorrência do UPSERT é coberto pelo
 * teste de integração do limiter base (T-50.3).
 */
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
  consumeDnsInstructionsSendRateLimit,
  DNS_INSTRUCTIONS_SEND_RATE_LIMIT,
  DNS_INSTRUCTIONS_SEND_RATE_LIMIT_MESSAGE,
} = await import("./dns-instructions-rate-limit")

describe("consumeDnsInstructionsSendRateLimit", () => {
  it("dentro do teto: UPSERT incrementa e o envio é permitido", async () => {
    queryRawMock.mockResolvedValueOnce([{ count: 3 }])

    const result = await consumeDnsInstructionsSendRateLimit("team-1")

    expect(result.allowed).toBe(true)
  })

  it("acima do teto: UPSERT não incrementa, envio bloqueado com retryAfterSeconds > 0", async () => {
    queryRawMock.mockResolvedValueOnce([])

    const result = await consumeDnsInstructionsSendRateLimit("team-1")

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("janela é por TIME (chave dns-instructions:<teamId>) com teto 5 por hora", async () => {
    lastQuery = null

    await consumeDnsInstructionsSendRateLimit("team-abc")

    expect(DNS_INSTRUCTIONS_SEND_RATE_LIMIT).toEqual({ limit: 5, windowMs: 60 * 60_000 })
    expect(lastQuery).not.toBeNull()
    expect(lastQuery!.values).toContain("dns-instructions:team-abc")
    expect(lastQuery!.values).toContain(5)
  })

  it("mensagem de 429 é copy de produto em pt-BR (passa intacta no toast)", () => {
    expect(DNS_INSTRUCTIONS_SEND_RATE_LIMIT_MESSAGE).toBe(
      "Limite de envios de instruções atingido. Tente novamente em alguns minutos."
    )
  })
})
