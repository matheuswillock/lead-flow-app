import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * Integração contra o Postgres local (:55322), não contra mocks.
 *
 * Motivo de existir separado do teste unitário: o invariante que importa aqui
 * é de concorrência — N+1 chamadas simultâneas não podem ultrapassar o teto
 * (T-10.9). Prisma mockado não tem `INSERT ... ON CONFLICT ... WHERE` real;
 * só o banco real prova que a corrida não estoura o limite.
 *
 * Rodar:
 *   WEBHOOKS_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test lib/webhooks/inbound-rate-limit.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.WEBHOOKS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:webhooks:local` ou passe a URL de 127.0.0.1:55322."
    )
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let consumeInboundRateLimit: typeof import("./inbound-rate-limit").consumeInboundRateLimit
let buildInboundWebhookBadTokenKey: typeof import("./inbound-rate-limit").buildInboundWebhookBadTokenKey
let INBOUND_WEBHOOK_RATE_LIMITS: typeof import("./inbound-rate-limit").INBOUND_WEBHOOK_RATE_LIMITS

if (RUN_INTEGRATION) {
  assertLocalDatabase()
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ consumeInboundRateLimit, buildInboundWebhookBadTokenKey, INBOUND_WEBHOOK_RATE_LIMITS } = await import(
    "./inbound-rate-limit"
  ))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("consumeInboundRateLimit — integração Postgres real (T-10.9)", () => {
  afterAll(async () => {
    if (!RUN_INTEGRATION) return
    await prisma.$executeRawUnsafe(
      `delete from webhooks_inbound_rate_limit_windows where key like 'test:%'`
    )
  })

  it("N+1 chamadas concorrentes com teto N → exatamente N aceitas, o resto 429 com retryAfter", async () => {
    const key = `test:${randomUUID()}`
    const limit = 5
    const now = new Date()

    const results = await Promise.all(
      Array.from({ length: limit + 3 }, () =>
        consumeInboundRateLimit(key, { limit, windowMs: 60_000 }, now)
      )
    )

    const allowedCount = results.filter((r) => r.allowed).length
    const rejected = results.filter((r) => !r.allowed)
    expect(allowedCount).toBe(limit)
    expect(rejected.length).toBe(3)
    for (const rejection of rejected) {
      expect(rejection.retryAfterSeconds).toBeGreaterThan(0)
    }
  })

  it("T-10.10: 21 tokens inválidos do mesmo IP/time em 5 min → as 20 primeiras passam, a 21ª leva 429", async () => {
    // R10-4 (revisão Opus): o teste unitário só conferia a constante
    // { limit: 20 }; este prova o comportamento real, sequencial (não
    // concorrente), usando a chave e o limite de badToken de verdade.
    const key = buildInboundWebhookBadTokenKey(randomUUID(), "203.0.113.10")
    const { limit, windowMs } = INBOUND_WEBHOOK_RATE_LIMITS.badToken
    expect(limit).toBe(20)
    const now = new Date()

    const results: Array<{ allowed: boolean; retryAfterSeconds: number }> = []
    for (let attempt = 1; attempt <= 21; attempt += 1) {
      results.push(await consumeInboundRateLimit(key, { limit, windowMs }, now))
    }

    const firstTwenty = results.slice(0, 20)
    const twentyFirst = results[20]

    expect(firstTwenty.every((result) => result.allowed)).toBe(true)
    expect(twentyFirst?.allowed).toBe(false)
    expect(twentyFirst?.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("consumo remove janelas além da retenção (limpeza oportunista)", async () => {
    const staleKey = `test:stale-${randomUUID()}`
    const staleWindowStart = new Date(Date.now() - 3 * 60 * 60_000) // 3h atrás > retenção de 2h

    await prisma.$executeRaw`
      insert into webhooks_inbound_rate_limit_windows (key, "windowStart", count, "createdAt", "updatedAt")
      values (${staleKey}, ${staleWindowStart}, 3, now(), now())
    `

    await consumeInboundRateLimit(`test:${randomUUID()}`, { limit: 5, windowMs: 60_000 })

    const remaining = await prisma.$queryRaw<Array<{ count: number }>>`
      select count from webhooks_inbound_rate_limit_windows where key = ${staleKey}
    `
    expect(remaining.length).toBe(0)
  })
})
