import { describe, expect, it } from "bun:test"
import { PaymentProviderConfig } from "./config"

const validConfig = {
  apiKey: "sk_test_provider",
  publicKey: "pk_test_provider",
  webhookSecret: "webhook-secret",
  webhookSigningKey: "hmac-secret",
  environment: "DEV" as const,
  devMode: true,
}

describe("PaymentProviderConfig", () => {
  it("rejects incomplete credentials", () => {
    expect(() => PaymentProviderConfig.create({ ...validConfig, apiKey: "" })).toThrow("incompleta")
  })

  it("rejects a DEV/production mismatch", () => {
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, environment: "PRODUCTION", devMode: true }),
    ).toThrow("produção")
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, environment: "DEV", devMode: false }),
    ).toThrow("DEV")
    expect(() =>
      PaymentProviderConfig.create({
        ...validConfig,
        environment: "STAGING" as "DEV",
      }),
    ).toThrow("ambiente")
  })

  it("accepts the Abacate public key as webhook signing key", () => {
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, webhookSigningKey: "pk_test_provider" }),
    ).not.toThrow()
  })

  describe("public key before card release", () => {
    const productionWithoutKey = {
      apiKey: "abc_prod_key",
      webhookSecret: "webhook-secret",
      environment: "PRODUCTION" as const,
      devMode: false,
    }

    it("allows PRODUCTION without public key or signing key", () => {
      const config = PaymentProviderConfig.create(productionWithoutKey)
      expect(config.publicKey).toBeNull()
      expect(config.webhookSigningKey).toBeNull()
      expect(config.fingerprint()).toBe("PRODUCTION:production:no-public-key")
    })

    it("still requires public key and signing key in DEV", () => {
      expect(() =>
        PaymentProviderConfig.create({ ...validConfig, publicKey: null, webhookSigningKey: null }),
      ).toThrow("incompleta")
    })

    it("treats a blank key as broken configuration, not as absent", () => {
      expect(() =>
        PaymentProviderConfig.create({ ...productionWithoutKey, publicKey: "  ", webhookSigningKey: "  " }),
      ).toThrow("incompleta")
    })

    it("never relaxes the webhook secret or API key", () => {
      expect(() => PaymentProviderConfig.create({ ...productionWithoutKey, webhookSecret: "" })).toThrow("incompleta")
      expect(() => PaymentProviderConfig.create({ ...productionWithoutKey, apiKey: "" })).toThrow("incompleta")
    })
  })

  it("freezes validated configuration at runtime", () => {
    const config = PaymentProviderConfig.create(validConfig)

    expect(Object.isFrozen(config)).toBe(true)
  })

  it("rejects non-official provider API hosts", () => {
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, baseUrl: "http://127.0.0.1:8080" }),
    ).toThrow("base URL")
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, baseUrl: "https://evil.example" }),
    ).toThrow("base URL")
    expect(() =>
      PaymentProviderConfig.create({
        ...validConfig,
        baseUrl: "https://api.abacatepay.com/v2?token=leak#hash",
      }),
    ).toThrow("base URL")
    expect(() =>
      PaymentProviderConfig.create({
        ...validConfig,
        baseUrl: "https://user:pass@api.abacatepay.com:444",
      }),
    ).toThrow("base URL")
  })

  it("normalizes the official provider base URL", () => {
    const config = PaymentProviderConfig.create({
      ...validConfig,
      baseUrl: "https://api.abacatepay.com/",
    })

    expect(config.baseUrl).toBe("https://api.abacatepay.com")
  })

  it("defaults to no previous secret and no mandatory signature", () => {
    const config = PaymentProviderConfig.create(validConfig)

    expect(config.webhookSecretPrevious).toBeNull()
    expect(config.requireSignature).toBe(false)
  })

  it("carries the previous secret and the signature requirement", () => {
    const config = PaymentProviderConfig.create({
      ...validConfig,
      webhookSecretPrevious: "old-secret",
      requireSignature: true,
    })

    expect(config.webhookSecretPrevious).toBe("old-secret")
    expect(config.requireSignature).toBe(true)
  })

  it("rejects a blank previous secret instead of silently ignoring it", () => {
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, webhookSecretPrevious: "  " }),
    ).toThrow("incompleta")
  })
})
