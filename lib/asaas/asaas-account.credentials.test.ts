import { afterEach, describe, expect, it } from "bun:test"
import { credentialCache } from "@/lib/payment-provider/credential-cache"
import { asaasInstanceSelector, resolveAsaasAccount } from "./asaas-account"

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
  credentialCache.invalidateAll()
})

describe("resolveAsaasAccount com credenciais do banco", () => {
  it("usa API_KEY/WEBHOOK_TOKEN do banco, mas NUNCA muda a URL base (SSRF)", () => {
    process.env.ASAAS_ENV = "sandbox"
    delete process.env.ASAAS_URL_sandbox
    credentialCache.set(asaasInstanceSelector("primary"), {
      instanceId: "i1",
      values: { API_KEY: "aact_from_db_000", WEBHOOK_TOKEN: "tok_db", BASE_URL: "https://evil.example.com" },
      sources: { API_KEY: "db", WEBHOOK_TOKEN: "db", BASE_URL: "db" },
      settings: {},
    })
    const account = resolveAsaasAccount("primary")
    expect(account.apiKey).toBe("aact_from_db_000")
    expect(account.webhookToken).toBe("tok_db")
    expect(account.baseUrl).toBe("https://sandbox.asaas.com")
  })

  it("sem credencial no banco o comportamento é o do ambiente", () => {
    process.env.ASAAS_API_KEY = "aact_env_000"
    expect(resolveAsaasAccount("primary").apiKey).toBe("aact_env_000")
  })
})
