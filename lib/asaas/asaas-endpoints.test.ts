import { describe, expect, it } from "bun:test"
import { buildAsaasEndpoints } from "./asaas-endpoints"

describe("buildAsaasEndpoints", () => {
  it("é pura: mesma baseUrl → mesmos endpoints", () => {
    const a = buildAsaasEndpoints("https://sandbox.asaas.com")
    const b = buildAsaasEndpoints("https://sandbox.asaas.com")

    expect(a.customers).toBe(b.customers)
    expect(a.subscriptions).toBe(b.subscriptions)
    expect(a.payments).toBe(b.payments)
    expect(a.checkouts).toBe(b.checkouts)
  })

  it("não lê process.env (pura de verdade)", () => {
    const originalEnv = process.env.ASAAS_URL
    process.env.ASAAS_URL = "https://outra-coisa.example.com"

    const endpoints = buildAsaasEndpoints("https://sandbox.asaas.com")
    expect(endpoints.customers).toBe("https://sandbox.asaas.com/api/v3/customers")

    if (originalEnv === undefined) delete process.env.ASAAS_URL
    else process.env.ASAAS_URL = originalEnv
  })

  it("sandbox e produção geram hosts distintos", () => {
    const sandbox = buildAsaasEndpoints("https://sandbox.asaas.com")
    const production = buildAsaasEndpoints("https://www.asaas.com")

    expect(sandbox.customers).toBe("https://sandbox.asaas.com/api/v3/customers")
    expect(production.customers).toBe("https://www.asaas.com/api/v3/customers")
    expect(sandbox.customers).not.toBe(production.customers)
  })

  it("monta todos os endpoints usados pelos 85 call-sites atuais", () => {
    const endpoints = buildAsaasEndpoints("https://sandbox.asaas.com")

    expect(endpoints.customers).toBe("https://sandbox.asaas.com/api/v3/customers")
    expect(endpoints.subscriptions).toBe("https://sandbox.asaas.com/api/v3/subscriptions")
    expect(endpoints.payments).toBe("https://sandbox.asaas.com/api/v3/payments")
    expect(endpoints.notifications).toBe("https://sandbox.asaas.com/api/v3/notifications")
    expect(endpoints.webhooks).toBe("https://sandbox.asaas.com/api/v3/notifications")
    expect(endpoints.checkouts).toBe("https://sandbox.asaas.com/api/v3/checkouts")
    expect(endpoints.notificationsBatch).toBe(
      "https://sandbox.asaas.com/api/v3/notifications/batch"
    )
    expect(endpoints.customerNotifications("cus_123")).toBe(
      "https://sandbox.asaas.com/api/v3/customers/cus_123/notifications"
    )
    expect(endpoints.notificationById("not_123")).toBe(
      "https://sandbox.asaas.com/api/v3/notifications/not_123"
    )
    expect(endpoints.pixQrCode("pay_123")).toBe(
      "https://sandbox.asaas.com/api/v3/payments/pay_123/pixQrCode"
    )
  })
})
