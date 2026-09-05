import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * Integração contra o Postgres local (:55322), não contra mocks.
 *
 * Motivo de existir separado do teste unitário: o invariante que importa aqui
 * é de concorrência — N+1 chamadas simultâneas não podem ultrapassar o teto.
 * Prisma mockado não tem `INSERT ... ON CONFLICT ... WHERE` real; só o banco
 * real prova que a corrida não estoura o limite (T-50.3).
 *
 * Rodar:
 *   BILLING_RATE_LIMIT_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test lib/billing/billing-rate-limit.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.BILLING_RATE_LIMIT_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:billing-rate-limit:local` ou passe a URL de 127.0.0.1:55322."
    )
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let consumeBillingRateLimit: typeof import("./billing-rate-limit").consumeBillingRateLimit

if (RUN_INTEGRATION) {
  assertLocalDatabase()
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ consumeBillingRateLimit } = await import("./billing-rate-limit"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("consumeBillingRateLimit — integração Postgres real (T-50.3)", () => {
  afterAll(async () => {
    if (!RUN_INTEGRATION) return
    await prisma.$executeRawUnsafe(`delete from billing_rate_limit_windows where key like 'test:%'`)
  })

  it("N+1 chamadas concorrentes com teto N → exatamente N permitidas", async () => {
    const key = `test:${randomUUID()}`
    const limit = 5
    const now = new Date()

    const results = await Promise.all(
      Array.from({ length: limit + 3 }, () =>
        consumeBillingRateLimit(key, { limit, windowMs: 60_000 }, now)
      )
    )

    const allowedCount = results.filter((r) => r.allowed).length
    expect(allowedCount).toBe(limit)
  })

  it("janela expirada reseta o orçamento", async () => {
    const key = `test:${randomUUID()}`
    const limit = 2
    const windowMs = 1_000
    const firstWindow = new Date(0)
    const nextWindow = new Date(windowMs)

    const first = await consumeBillingRateLimit(key, { limit, windowMs }, firstWindow)
    const second = await consumeBillingRateLimit(key, { limit, windowMs }, firstWindow)
    const third = await consumeBillingRateLimit(key, { limit, windowMs }, firstWindow)
    const afterReset = await consumeBillingRateLimit(key, { limit, windowMs }, nextWindow)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(afterReset.allowed).toBe(true)
  })
})
