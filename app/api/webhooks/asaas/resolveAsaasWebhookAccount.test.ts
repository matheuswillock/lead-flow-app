import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { resolveAsaasWebhookAccount } from "./resolveAsaasWebhookAccount"

const ENV_KEYS = [
  "ASAAS_ENV",
  "ASAAS_API_KEY",
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
  process.env.ASAAS_ENV = "sandbox"
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
})

describe("resolveAsaasWebhookAccount (M3.1 — E4/T-10.9)", () => {
  it("token igual ao da conta primary → 'primary'", () => {
    process.env.ASAAS_API_KEY = "aact_primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"

    expect(resolveAsaasWebhookAccount("token-primary")).toBe("primary")
  })

  it("token igual ao da conta legacy → 'legacy'", () => {
    process.env.ASAAS_API_KEY = "aact_primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy"
    process.env.ASAAS_LEGACY_WEBHOOK_TOKEN = "token-legacy"

    expect(resolveAsaasWebhookAccount("token-legacy")).toBe("legacy")
  })

  it("token que não bate com nenhum dos dois → null", () => {
    process.env.ASAAS_API_KEY = "aact_primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy"
    process.env.ASAAS_LEGACY_WEBHOOK_TOKEN = "token-legacy"

    expect(resolveAsaasWebhookAccount("token-aleatorio")).toBeNull()
  })

  it("pré-cutover (sem ASAAS_LEGACY_API_KEY configurada): só primary é aceito, sem lançar", () => {
    process.env.ASAAS_API_KEY = "aact_primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"

    expect(() => resolveAsaasWebhookAccount("token-legacy")).not.toThrow()
    expect(resolveAsaasWebhookAccount("token-legacy")).toBeNull()
    expect(resolveAsaasWebhookAccount("token-primary")).toBe("primary")
  })

  it("token vazio/ausente → null", () => {
    process.env.ASAAS_API_KEY = "aact_primary"
    process.env.ASAAS_WEBHOOK_TOKEN = "token-primary"

    expect(resolveAsaasWebhookAccount("")).toBeNull()
  })
})
