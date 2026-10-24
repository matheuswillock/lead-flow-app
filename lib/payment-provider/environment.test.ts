import { describe, expect, it } from "bun:test"
import { derivePaymentProviderEnvironment } from "./environment"

describe("derivePaymentProviderEnvironment", () => {
  it("deriva PRODUCTION do deploy de produção e DEV do restante", () => {
    expect(derivePaymentProviderEnvironment({ VERCEL_ENV: "production" })).toBe("PRODUCTION")
    expect(derivePaymentProviderEnvironment({ VERCEL_ENV: "preview" })).toBe("DEV")
    expect(derivePaymentProviderEnvironment({})).toBe("DEV")
  })

  it("a variável legada mantém precedência (compatibilidade)", () => {
    expect(
      derivePaymentProviderEnvironment({ PAYMENT_PROVIDER_ENVIRONMENT: "DEV", VERCEL_ENV: "production" }),
    ).toBe("DEV")
    expect(derivePaymentProviderEnvironment({ PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION" })).toBe("PRODUCTION")
  })

  it("valor legado inválido devolve null (falha fechada)", () => {
    expect(derivePaymentProviderEnvironment({ PAYMENT_PROVIDER_ENVIRONMENT: "STAGING" })).toBeNull()
  })
})
