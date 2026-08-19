import { describe, expect, it, mock } from "bun:test"

// mock.module precisa vir ANTES de qualquer import de rate-limit.ts nesse
// processo de teste — por isso este é um arquivo separado de
// rate-limit.test.ts, que já importa o módulo real no topo.
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $queryRaw: async () => {
      throw new Error("connection lost")
    },
  },
}))

const { consumePublicFormRateLimit } = await import("./rate-limit")

describe("rate limit falha fechado em erro de banco (achado #2)", () => {
  it("nega a requisição quando o $queryRaw lança, em vez de liberar por padrão", async () => {
    const result = await consumePublicFormRateLimit("form:db-down", { limit: 120, windowMs: 60_000 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })
})
