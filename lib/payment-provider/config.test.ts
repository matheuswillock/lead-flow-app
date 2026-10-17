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

  it("rejects a browser public key as webhook signing key", () => {
    expect(() =>
      PaymentProviderConfig.create({ ...validConfig, webhookSigningKey: "pk_wrong" }),
    ).toThrow("assinatura")
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
})
