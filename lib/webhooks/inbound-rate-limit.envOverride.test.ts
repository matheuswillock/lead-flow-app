import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * R10-9 (revisão Opus, Protocolo 96) — DA3 pede limites ajustáveis por env
 * sem redeploy. Os limites são lidos no import do módulo, então este
 * arquivo isola o `process.env` ANTES de importar (arquivo próprio para não
 * contaminar `inbound-rate-limit.test.ts`, que precisa dos defaults).
 */
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $queryRaw: mock(async () => [{ count: 1 }]) },
}))

const ENV_VARS = [
  "WEBHOOKS_INBOUND_RATE_LIMIT_IP",
  "WEBHOOKS_INBOUND_RATE_LIMIT_BAD_TOKEN",
  "WEBHOOKS_INBOUND_RATE_LIMIT_WEBHOOK_PER_MINUTE",
  "WEBHOOKS_INBOUND_RATE_LIMIT_WEBHOOK_PER_HOUR",
  "WEBHOOKS_INBOUND_RATE_LIMIT_TEAM",
] as const

const originalEnv: Record<string, string | undefined> = {}
for (const key of ENV_VARS) originalEnv[key] = process.env[key]

afterEach(() => {
  for (const key of ENV_VARS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

describe("INBOUND_WEBHOOK_RATE_LIMITS — override por env (R10-9)", () => {
  it("WEBHOOKS_INBOUND_RATE_LIMIT_BAD_TOKEN=5 sobrepõe o default de 20", async () => {
    process.env.WEBHOOKS_INBOUND_RATE_LIMIT_BAD_TOKEN = "5"
    const { INBOUND_WEBHOOK_RATE_LIMITS } = await import(`./inbound-rate-limit?t=${Date.now()}`)

    expect(INBOUND_WEBHOOK_RATE_LIMITS.badToken.limit).toBe(5)
    // windowMs não é configurável por env — estrutural (retenção depende dele).
    expect(INBOUND_WEBHOOK_RATE_LIMITS.badToken.windowMs).toBe(5 * 60_000)
  })

  it("valor inválido (não numérico) cai no default em vez de derrubar o rate limit", async () => {
    process.env.WEBHOOKS_INBOUND_RATE_LIMIT_IP = "not-a-number"
    const { INBOUND_WEBHOOK_RATE_LIMITS } = await import(`./inbound-rate-limit?t=${Date.now()}`)

    expect(INBOUND_WEBHOOK_RATE_LIMITS.ip.limit).toBe(120)
  })

  it("valor <= 0 cai no default (nunca desliga o rate limit por acidente)", async () => {
    process.env.WEBHOOKS_INBOUND_RATE_LIMIT_TEAM = "0"
    const { INBOUND_WEBHOOK_RATE_LIMITS } = await import(`./inbound-rate-limit?t=${Date.now()}`)

    expect(INBOUND_WEBHOOK_RATE_LIMITS.team.limit).toBe(300)
  })
})
