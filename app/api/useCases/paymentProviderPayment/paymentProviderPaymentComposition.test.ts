import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  createAbacatePayProvider,
  createAbacatePayProviderRegistry,
  resolvePaymentProviderEnvironment,
} from "./paymentProviderPaymentComposition"

const ENV_KEYS = [
  "PAYMENT_PROVIDER_ENVIRONMENT",
  "ABACATE_PAY_API_KEY",
  "ABACATE_PAY_WEBHOOK_SECRET",
  "ABACATE_PAY_PUBLIC_KEY",
  "ABACATE_PAY_DEV_API_KEY",
  "ABACATE_PAY_DEV_WEBHOOK_SECRET",
  "ABACATE_PAY_DEV_PUBLIC_KEY",
  "ABACATE_PAY_PRODUCTION_API_KEY",
  "ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET",
  "ABACATE_PAY_PRODUCTION_PUBLIC_KEY",
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function setProductionSecrets() {
  process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
  process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
}

describe("resolvePaymentProviderEnvironment", () => {
  it("usa DEV quando a variável não está definida", () => {
    expect(resolvePaymentProviderEnvironment()).toBe("DEV")
  })

  it("aceita PRODUCTION", () => {
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    expect(resolvePaymentProviderEnvironment()).toBe("PRODUCTION")
  })

  it("rejeita ambiente inválido", () => {
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "STAGING"
    expect(() => resolvePaymentProviderEnvironment()).toThrow("PAYMENT_PROVIDER_ENVIRONMENT inválido")
  })
})

describe("createAbacatePayProviderRegistry", () => {
  it("em PRODUCTION sem PUBLIC_KEY não lança e deixa CARD fora das capabilities", async () => {
    setProductionSecrets()

    const metadata = (await createAbacatePayProviderRegistry("PRODUCTION")).get("ABACATE_PAY", "PRODUCTION")

    expect(metadata?.environment).toBe("PRODUCTION")
    expect(metadata?.capabilities).toContain("PIX")
    expect(metadata?.capabilities).not.toContain("CARD")
  })

  it("em PRODUCTION com PUBLIC_KEY inclui CARD", async () => {
    setProductionSecrets()
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "prod-public-key"

    const metadata = (await createAbacatePayProviderRegistry("PRODUCTION")).get("ABACATE_PAY", "PRODUCTION")

    expect(metadata?.capabilities).toContain("CARD")
  })

  it("registra o ambiente real e não o DEV", async () => {
    setProductionSecrets()

    const registry = await createAbacatePayProviderRegistry("PRODUCTION")

    expect(registry.get("ABACATE_PAY", "DEV")).toBeNull()
  })
})

describe("createAbacatePayProvider", () => {
  it("cria o provider de PRODUCTION sem PUBLIC_KEY", async () => {
    setProductionSecrets()
    await expect(createAbacatePayProvider("PRODUCTION")).resolves.toBeDefined()
  })

  it("lança quando o segredo API_KEY está ausente", async () => {
    process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
    await expect(createAbacatePayProvider("PRODUCTION")).rejects.toThrow("Segredo API_KEY do provider não configurado")
  })

  it("lança quando o segredo WEBHOOK_SECRET está ausente", async () => {
    process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
    await expect(createAbacatePayProvider("PRODUCTION")).rejects.toThrow(
      "Segredo WEBHOOK_SECRET do provider não configurado",
    )
  })
})
