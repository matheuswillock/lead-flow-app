import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { PaymentProviderBase } from "./PaymentProviderBase"
import { AsaasPaymentProvider, type AsaasProviderRuntimeConfig } from "./AsaasPaymentProvider"

const ASAAS_ENV_KEYS = ["ASAAS_ENV", "ASAAS_URL", "ASAAS_URL_sandbox"] as const

let envSnapshot = new Map<string, string | undefined>()

function withEnv(overrides: Readonly<Record<string, string | undefined>>, run: () => void): void {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    run()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe("AsaasPaymentProvider", () => {
  beforeEach(() => {
    envSnapshot = new Map(ASAAS_ENV_KEYS.map((key) => [key, process.env[key]]))
    for (const key of ASAAS_ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const [key, value] of envSnapshot) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it("binds the primary Asaas account and a real base URL without declaring capabilities", () => {
    const provider = new AsaasPaymentProvider({} as never)

    expect(provider).toBeInstanceOf(PaymentProviderBase)
    expect(provider.key).toBe("ASAAS")
    expect(provider.account).toBe("primary")
    expect(provider.baseUrl).toMatch(/^https:\/\/.+/)
    expect(provider.metadata.capabilities).toEqual([])
  })

  it("derives the environment from the resolved Asaas account", () => {
    withEnv({ ASAAS_ENV: "sandbox", ASAAS_URL: undefined, ASAAS_URL_sandbox: undefined }, () => {
      expect(new AsaasPaymentProvider({} as never).environment).toBe("DEV")
    })
    withEnv({ ASAAS_ENV: "production", ASAAS_URL: undefined, ASAAS_URL_sandbox: undefined }, () => {
      expect(new AsaasPaymentProvider({} as never).environment).toBe("PRODUCTION")
    })
  })

  it("honours the environment declared in an explicit configuration", () => {
    const provider = new AsaasPaymentProvider({} as never, {
      config: {
        baseUrl: "https://sandbox.asaas.com",
        account: "primary",
        environment: "DEV",
      },
    })

    expect(provider.environment).toBe("DEV")
    expect(provider.metadata.environment).toBe("DEV")
  })

  it("binds an explicitly injected account", () => {
    const provider = new AsaasPaymentProvider({} as never, {
      config: {
        baseUrl: "https://sandbox.asaas.com",
        account: "legacy",
        environment: "DEV",
      },
    })

    expect(provider.account).toBe("legacy")
  })

  it("does not retain a mutable reference to the injected configuration", () => {
    const config = {
      baseUrl: "https://sandbox.asaas.com",
      account: "primary" as const,
      environment: "DEV" as const,
    }
    const provider = new AsaasPaymentProvider({} as never, { config })

    config.baseUrl = "https://evil.example.com"

    expect(provider.baseUrl).toBe("https://sandbox.asaas.com")
  })

  it("classifies configuration failures as CONFIGURATION_INVALID", () => {
    const invalidConfigs: AsaasProviderRuntimeConfig[] = [
      { baseUrl: "  ", account: "primary", environment: "DEV" },
      { baseUrl: "http://sandbox.asaas.com", account: "primary", environment: "DEV" },
      { baseUrl: "https://sandbox.asaas.com/path", account: "primary", environment: "DEV" },
      { baseUrl: "https://user:pass@sandbox.asaas.com", account: "primary", environment: "DEV" },
      { baseUrl: "https://sandbox.asaas.com", account: "primary", environment: "PRODUCTION" },
      { baseUrl: "https://sandbox.asaas.com.", account: "primary", environment: "PRODUCTION" },
      { baseUrl: "https://www.asaas.com.", account: "primary", environment: "DEV" },
      { baseUrl: "https://sandbox..asaas.com", account: "primary", environment: "DEV" },
      { baseUrl: "https://sandbox.asaas.com", account: "primary", environment: "sandbox" as never },
    ]

    for (const config of invalidConfigs) {
      let thrown: unknown
      try {
        new AsaasPaymentProvider({} as never, { config })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(PaymentProviderError)
      expect((thrown as PaymentProviderError).code).toBe("CONFIGURATION_INVALID")
    }
  })

  it("exposes the legacy gateway port untouched and declares no new capabilities", () => {
    const gateway = { removeLegacySubscription: async () => ({ deleted: true }) } as never
    const provider = new AsaasPaymentProvider(gateway)

    expect(provider.gateway).toBe(gateway)
    expect(provider.metadata.capabilities).toEqual([])
  })
})
