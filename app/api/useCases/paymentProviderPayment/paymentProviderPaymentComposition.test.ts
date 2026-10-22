import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { credentialCache } from "@/lib/payment-provider/credential-cache"
import {
  buildAbacatePayProviderConfig,
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
  "ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET_PREVIOUS",
  "ABACATE_PAY_PRODUCTION_REQUIRE_SIGNATURE",
  "VERCEL_ENV",
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  credentialCache.invalidateAll()
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
  it("em PRODUCTION sem PUBLIC_KEY não lança e deixa CARD fora das capabilities", () => {
    setProductionSecrets()

    const metadata = createAbacatePayProviderRegistry("PRODUCTION").get("ABACATE_PAY", "PRODUCTION")

    expect(metadata?.environment).toBe("PRODUCTION")
    expect(metadata?.capabilities).toContain("PIX")
    expect(metadata?.capabilities).not.toContain("CARD")
  })

  it("em PRODUCTION com PUBLIC_KEY inclui CARD", () => {
    setProductionSecrets()
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "prod-public-key"

    const metadata = createAbacatePayProviderRegistry("PRODUCTION").get("ABACATE_PAY", "PRODUCTION")

    expect(metadata?.capabilities).toContain("CARD")
  })

  it("registra o ambiente real e não o DEV", () => {
    setProductionSecrets()

    const registry = createAbacatePayProviderRegistry("PRODUCTION")

    expect(registry.get("ABACATE_PAY", "DEV")).toBeNull()
  })
})

describe("createAbacatePayProvider", () => {
  it("cria o provider de PRODUCTION sem PUBLIC_KEY", () => {
    setProductionSecrets()
    expect(() => createAbacatePayProvider("PRODUCTION")).not.toThrow()
  })

  it("lança quando o segredo API_KEY está ausente", () => {
    process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
    expect(() => createAbacatePayProvider("PRODUCTION")).toThrow("Segredo API_KEY do provider não configurado")
  })

  it("lança quando o segredo WEBHOOK_SECRET está ausente", () => {
    process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
    expect(() => createAbacatePayProvider("PRODUCTION")).toThrow(
      "Segredo WEBHOOK_SECRET do provider não configurado",
    )
  })
})

describe("buildAbacatePayProviderConfig (rotação e assinatura obrigatória)", () => {
  it("alimenta webhookSecretPrevious e requireSignature a partir das credenciais do ambiente", () => {
    setProductionSecrets()
    process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET_PREVIOUS = "old-secret"
    process.env.ABACATE_PAY_PRODUCTION_REQUIRE_SIGNATURE = "true"
    const config = buildAbacatePayProviderConfig("PRODUCTION")
    expect(config.webhookSecretPrevious).toBe("old-secret")
    expect(config.requireSignature).toBe(true)
  })

  it("padrão: sem segredo anterior e sem assinatura obrigatória", () => {
    setProductionSecrets()
    const config = buildAbacatePayProviderConfig("PRODUCTION")
    expect(config.webhookSecretPrevious).toBeNull()
    expect(config.requireSignature).toBe(false)
  })

  it("credenciais do banco (cache) vencem o ambiente e settings.requireSignature liga a exigência", () => {
    setProductionSecrets()
    credentialCache.set(
      { provider: "ABACATE_PAY", environment: "PRODUCTION" },
      {
        instanceId: "i1",
        values: { API_KEY: "db-api-key", WEBHOOK_SECRET: "db-webhook", WEBHOOK_SECRET_PREVIOUS: "db-old" },
        sources: { API_KEY: "db", WEBHOOK_SECRET: "db", WEBHOOK_SECRET_PREVIOUS: "db" },
        settings: { requireSignature: true },
      },
    )
    const config = buildAbacatePayProviderConfig("PRODUCTION")
    expect(config.apiKey).toBe("db-api-key")
    expect(config.webhookSecret).toBe("db-webhook")
    expect(config.webhookSecretPrevious).toBe("db-old")
    expect(config.requireSignature).toBe(true)
  })

  it("ambiente de execução vem do deploy (VERCEL_ENV) e a variável legada tem precedência", () => {
    process.env.VERCEL_ENV = "production"
    expect(resolvePaymentProviderEnvironment()).toBe("PRODUCTION")
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "DEV"
    expect(resolvePaymentProviderEnvironment()).toBe("DEV")
  })
})

describe("credenciais por instância (multi-instância do Abacate)", () => {
  const instanceB = {
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    externalAccountContext: "ctx-b",
  } as const

  function warm(values: Record<string, string>) {
    credentialCache.set(instanceB, {
      instanceId: "b",
      values,
      sources: Object.fromEntries(Object.keys(values).map((key) => [key, "db" as const])),
      settings: {},
    })
  }

  it("a instância B (default) usa as credenciais de B, não as do ambiente da principal", () => {
    setProductionSecrets()
    warm({ API_KEY: "b-api-key", WEBHOOK_SECRET: "b-webhook-secret", PUBLIC_KEY: "b-public" })
    const config = buildAbacatePayProviderConfig("PRODUCTION", "ctx-b")
    expect(config.apiKey).toBe("b-api-key")
    expect(config.webhookSecret).toBe("b-webhook-secret")
    expect(buildAbacatePayProviderConfig("PRODUCTION").apiKey).toBe("prod-api-key")
  })

  it("instância B com cache frio NÃO herda o ambiente da principal (falha fechada)", () => {
    setProductionSecrets()
    expect(() => createAbacatePayProvider("PRODUCTION", "ctx-b")).toThrow(
      "Segredo API_KEY do provider não configurado",
    )
  })
})
