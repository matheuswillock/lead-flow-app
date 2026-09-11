import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado P1 do Cursor round 3 no PR #1138 (20 — Assinaturas — Backend E3,
// DA2): reactivateSubscription cria a nova assinatura PIX na conta do
// ponteiro (reactivateSubscriptionAccount), mas o bloco que busca o
// payment/QR code do PIX consultava sempre o client global `asaasFetch`
// (primary). Manager legacy reativando por PIX recebia sucesso sem
// pixQrCode/pixCopyPaste — o catch engolia o 404 de conta errada
// silenciosamente.
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = { profile: { findUnique: findUniqueMock, update: profileUpdateMock } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const cancelSubscriptionMock = mock(async () => ({ deleted: true }))
const createSubscriptionMock = mock(async (_data: unknown, accountId?: string) => ({
  success: true,
  subscriptionId: "sub_new",
  data: { id: "sub_new", value: 59.9, status: "PENDING" },
}))
const getSubscriptionPaymentsMock = mock(async (_subscriptionId: string, _params: unknown, _accountId?: string) => [
  { id: "pay_new", invoiceUrl: "https://asaas.test/inv/pay_new" },
])
const getPixQrCodeMock = mock(async (_paymentId: string, _accountId?: string) => ({
  encodedImage: "base64img",
  payload: "pix-copy-paste",
  expirationDate: "2026-10-01",
}))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    cancelSubscription: cancelSubscriptionMock,
    createSubscription: createSubscriptionMock,
    getSubscriptionPayments: getSubscriptionPaymentsMock,
    getPixQrCode: getPixQrCodeMock,
    getSubscription: mock(async () => ({ value: 0 })),
    updateSubscription: mock(async () => ({})),
  },
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

function buildManager(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "manager-reactivate-1",
    supabaseId: "sb-reactivate-1",
    asaasCustomerId: "cus_reactivate",
    asaasCustomerAccount: "legacy",
    asaasSubscriptionId: null,
    asaasSubscriptionAccount: "legacy",
    subscriptionNextDueDate: new Date("2026-10-01T00:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    ...overrides,
  }
}

describe("SubscriptionUpgradeUseCase.reactivateSubscription — PIX roteado por conta (achado P1 round 3)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    profileUpdateMock.mockClear()
    cancelSubscriptionMock.mockClear()
    createSubscriptionMock.mockClear()
    getSubscriptionPaymentsMock.mockClear()
    getPixQrCodeMock.mockClear()
  })

  it("manager legacy reativando via PIX: busca payments/QR na conta legacy, não primary", async () => {
    findUniqueMock.mockImplementationOnce(async () => buildManager())

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.reactivateSubscription({
      supabaseId: "sb-reactivate-1",
      operatorCount: 0,
      paymentMethod: "PIX",
      remoteIp: "127.0.0.1",
    })

    expect(result.isValid).toBe(true)
    expect(createSubscriptionMock).toHaveBeenCalledWith(expect.anything(), "legacy")
    expect(getSubscriptionPaymentsMock).toHaveBeenCalledWith("sub_new", undefined, "legacy")
    expect(getPixQrCodeMock).toHaveBeenCalledWith("pay_new", "legacy")
    expect((result.result as any).pixQrCode).toBe("base64img")
    expect((result.result as any).pixCopyPaste).toBe("pix-copy-paste")
  })

  it("manager primary reativando via PIX: busca payments/QR na conta primary", async () => {
    findUniqueMock.mockImplementationOnce(async () =>
      buildManager({ asaasCustomerAccount: "primary", asaasSubscriptionAccount: "primary" }),
    )

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.reactivateSubscription({
      supabaseId: "sb-reactivate-1",
      operatorCount: 0,
      paymentMethod: "PIX",
      remoteIp: "127.0.0.1",
    })

    expect(result.isValid).toBe(true)
    expect(getSubscriptionPaymentsMock).toHaveBeenCalledWith("sub_new", undefined, "primary")
    expect(getPixQrCodeMock).toHaveBeenCalledWith("pay_new", "primary")
  })
})
