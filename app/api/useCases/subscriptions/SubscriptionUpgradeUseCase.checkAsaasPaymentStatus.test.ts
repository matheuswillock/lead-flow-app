import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado P1 do Cursor (PR #1138, round 2): createAsaasCheckoutLink passou a
// criar o payment do operador na conta resolvida do manager (E3), mas
// checkAsaasPaymentStatus continuava consultando sempre a primary via
// asaasFetch global — um manager legacy pagava e a confirmação nunca via o
// pagamento (404 na primary), então o operador nunca era provisionado.
// Corrigido reusando getPaymentByAccountWithFallback (mesmo helper do E5).
const getPaymentByAccountWithFallbackMock = mock(
  async (_paymentId: string, _knownAccount?: unknown) =>
    ({ found: false }) as { found: false } | { found: true; payment: Record<string, unknown>; account: string },
)
mock.module("@/lib/billing/get-payment-by-account", () => ({
  getPaymentByAccountWithFallback: getPaymentByAccountWithFallbackMock,
}))

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {}, default: {} }))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: { getSubscription: mock(async () => ({})), createSubscription: mock(async () => ({})), updateSubscription: mock(async () => ({})), cancelSubscription: mock(async () => ({})) },
}))
mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus_x" })) },
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock(() => ({ endpoints: { customers: "", subscriptions: "", payments: "" }, request: mock(async () => ({})) })),
  asaasFetch: mock(async () => ({})),
  asaasApi: { customers: "", subscriptions: "", payments: "", pixQrCode: () => "" },
}))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => null }))
mock.module("@/lib/services/EmailService", () => ({ getEmailService: () => ({}) }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: mock(async () => "") }))

const { SubscriptionUpgradeUseCase } = await import("./SubscriptionUpgradeUseCase")

describe("SubscriptionUpgradeUseCase.checkAsaasPaymentStatus — roteado por conta com fallback (achado P1 round 2)", () => {
  beforeEach(() => {
    getPaymentByAccountWithFallbackMock.mockClear()
  })

  it("conta conhecida (manager legacy) → passa direto para getPaymentByAccountWithFallback, sem tentar as duas", async () => {
    getPaymentByAccountWithFallbackMock.mockImplementationOnce(async () => ({
      found: true,
      payment: { status: "CONFIRMED", externalReference: "pending-operator-1", value: 19.9, billingType: "PIX" },
      account: "legacy",
    }))

    const useCase = new SubscriptionUpgradeUseCase() as any
    const result = await useCase.checkAsaasPaymentStatus("pay_legacy_1", "legacy")

    expect(result.success).toBe(true)
    expect(result.status).toBe("CONFIRMED")
    expect(getPaymentByAccountWithFallbackMock).toHaveBeenCalledWith("pay_legacy_1", "legacy")
  })

  it("conta desconhecida → delega o fallback primary→legacy ao helper (sem forçar só primary)", async () => {
    getPaymentByAccountWithFallbackMock.mockImplementationOnce(async () => ({
      found: true,
      payment: { status: "RECEIVED", externalReference: "pending-operator-2", value: 19.9, billingType: "PIX" },
      account: "legacy",
    }))

    const useCase = new SubscriptionUpgradeUseCase() as any
    const result = await useCase.checkAsaasPaymentStatus("pay_unknown_2")

    expect(result.success).toBe(true)
    expect(getPaymentByAccountWithFallbackMock).toHaveBeenCalledWith("pay_unknown_2", undefined)
  })

  it("payment não encontrado em nenhuma conta → success=false (nunca lança)", async () => {
    getPaymentByAccountWithFallbackMock.mockImplementationOnce(async () => ({ found: false }))

    const useCase = new SubscriptionUpgradeUseCase() as any
    const result = await useCase.checkAsaasPaymentStatus("pay_missing_3", "primary")

    expect(result.success).toBe(false)
  })
})
