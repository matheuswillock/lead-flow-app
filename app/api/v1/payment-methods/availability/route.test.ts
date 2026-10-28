import { afterEach, describe, expect, it, mock } from "bun:test"

import * as realNextServer from "next/server"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"

// `connection()` só existe dentro de um request do Next; o resto do módulo continua o real.
mock.module("next/server", () => ({
  ...realNextServer,
  connection: async () => undefined,
}))

const { GET } = await import("./route")

const originalEnv = { ...process.env }
let restoreConfig: () => void = () => undefined
afterEach(() => {
  restoreConfig()
  process.env = { ...originalEnv }
})

describe("GET /api/v1/payment-methods/availability", () => {
  it("cartão desligado -> só PIX, com cache curto", async () => {
    restoreConfig = stubCardEnabledConfig(true)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.result.availableBillingTypes).toEqual(["PIX"])
    expect(json.result.card).toBe(false)
    expect(response.headers.get("Cache-Control")).toContain("max-age=30")
  })

  it("chave pública presente mas cartão desligado no backoffice -> só PIX", async () => {
    restoreConfig = stubCardEnabledConfig(false)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    delete process.env.CARD_PAYMENTS_ENABLED

    const response = await GET()
    const json = await response.json()

    expect(json.result.availableBillingTypes).toEqual(["PIX"])
    expect(json.result.card).toBe(false)
    expect(json.result.reason).toBe("DISABLED_BY_BACKOFFICE")
    expect(response.headers.get("Cache-Control")).toContain("max-age=30")
  })

  it("chave pública presente e cartão ligado no backoffice -> PIX e cartão", async () => {
    restoreConfig = stubCardEnabledConfig(true)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    delete process.env.CARD_PAYMENTS_ENABLED

    const json = await (await GET()).json()

    expect(json.result.availableBillingTypes).toEqual(["PIX", "CREDIT_CARD"])
  })

  it("CARD_PAYMENTS_ENABLED=false desliga mesmo com a chave", async () => {
    restoreConfig = stubCardEnabledConfig(true)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const json = await (await GET()).json()

    expect(json.result.availableBillingTypes).toEqual(["PIX"])
    expect(json.result.reason).toBe("DISABLED_BY_FLAG")
  })
})
