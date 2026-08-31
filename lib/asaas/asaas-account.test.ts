import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { resolveAsaasAccount } from "./asaas-account"

// NODE_ENV é readonly no tipo do process.env — os testes aqui fixam sempre
// ASAAS_ENV (que tem prioridade sobre NODE_ENV em resolveAsaasAccount), então
// NODE_ENV nunca precisa ser mutado.
const ENV_KEYS = [
  "ASAAS_ENV",
  "ASAAS_URL",
  "ASAAS_URL_sandbox",
  "ASAAS_API_KEY",
  "ASAAS_WALLET_ID",
  "ASAAS_WEBHOOK_TOKEN",
  "ASAAS_LEGACY_API_KEY",
  "ASAAS_LEGACY_WEBHOOK_TOKEN",
] as const

let snapshot: Record<string, string | undefined> = {}

beforeEach(() => {
  snapshot = {}
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
})

describe("resolveAsaasAccount", () => {
  it("primary lê ASAAS_API_KEY/ASAAS_WALLET_ID/ASAAS_WEBHOOK_TOKEN", () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_API_KEY = "aact_primary_key"
    process.env.ASAAS_WALLET_ID = "wallet-primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"

    const account = resolveAsaasAccount("primary")

    expect(account.accountId).toBe("primary")
    expect(account.apiKey).toBe("aact_primary_key")
    expect(account.walletId).toBe("wallet-primary")
    expect(account.webhookToken).toBe("token-primary")
    expect(account.baseUrl).toBe("https://sandbox.asaas.com")
  })

  it("legacy lê ASAAS_LEGACY_API_KEY/ASAAS_LEGACY_WEBHOOK_TOKEN", () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
    process.env.ASAAS_LEGACY_WEBHOOK_TOKEN = "token-legacy"

    const account = resolveAsaasAccount("legacy")

    expect(account.accountId).toBe("legacy")
    expect(account.apiKey).toBe("aact_legacy_key")
    expect(account.webhookToken).toBe("token-legacy")
    expect(account.baseUrl).toBe("https://sandbox.asaas.com")
  })

  it("primary e legacy devolvem apiKey/webhookToken distintos a partir de envs mockadas", () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_API_KEY = "aact_primary_key"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
    process.env.ASAAS_LEGACY_WEBHOOK_TOKEN = "token-legacy"

    const primary = resolveAsaasAccount("primary")
    const legacy = resolveAsaasAccount("legacy")

    expect(primary.apiKey).not.toBe(legacy.apiKey)
    expect(primary.webhookToken).not.toBe(legacy.webhookToken)
  })

  it("legacy sem ASAAS_LEGACY_API_KEY lança erro claro", () => {
    process.env.ASAAS_ENV = "sandbox"

    expect(() => resolveAsaasAccount("legacy")).toThrow(/ASAAS_LEGACY_API_KEY/)
  })

  it("primary sem ASAAS_API_KEY NÃO lança (compat com os getters legados de lib/asaas.ts)", () => {
    process.env.ASAAS_ENV = "sandbox"

    const account = resolveAsaasAccount("primary")
    expect(account.apiKey).toBeUndefined()
    expect(account.baseUrl).toBe("https://sandbox.asaas.com")
  })

  it("resolução de ambiente é uma dimensão só (ASAAS_ENV) — mesma baseUrl para as duas contas (C30)", () => {
    process.env.ASAAS_ENV = "production"
    process.env.ASAAS_URL = "https://www.asaas.com"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
    process.env.ASAAS_API_KEY = "aact_primary_key"

    expect(resolveAsaasAccount("primary").baseUrl).toBe("https://www.asaas.com")
    expect(resolveAsaasAccount("legacy").baseUrl).toBe("https://www.asaas.com")
  })
})
