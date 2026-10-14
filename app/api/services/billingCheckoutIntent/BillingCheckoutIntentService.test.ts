import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://app.test${path}`,
}))

const requestMock = mock(async (_endpoint: string, _init?: RequestInit): Promise<any> => ({
  id: "checkout-1",
}))
const createAsaasClientMock = mock(() => ({
  endpoints: { checkouts: "https://asaas.test/checkouts" },
  request: requestMock,
}))
mock.module("@/lib/asaas", () => ({ createAsaasClient: createAsaasClientMock }))

const { BillingCheckoutIntentService } = await import("./BillingCheckoutIntentService")

describe("BillingCheckoutIntentService", () => {
  let repository: any
  let priceResolver: any

  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({ id: "checkout-1" })
    repository = {
      findByTokenHash: mock(async () => ({
        id: "intent-1",
        profileId: "profile-1",
        asaasCustomerId: "cus-1",
        asaasAccount: "primary",
        productSlug: "crm",
        productId: null,
        cycle: "monthly",
        externalReference: "billing-intent:profile-1",
        status: "awaiting_method",
        expiresAt: new Date(Date.now() + 60_000),
        checkoutId: null,
        checkoutUrl: null,
      })),
      findReusableCheckout: mock(async () => null),
      create: mock(async (input: any) => ({
        id: "intent-new",
        ...input,
        status: "awaiting_method",
        expiresAt: new Date(Date.now() + 60_000),
      })),
      markCheckoutCreated: mock(async () => ({})),
      markSuperseded: mock(async () => ({})),
      markManualReconciliation: mock(async () => ({})),
    }
    priceResolver = {
      resolvePrice: mock(async ({ method }: { method: string }) => method === "PIX" ? 89.9 : 102.9),
    }
  })

  it("resolve o preço vigente por método, sem aceitar valor do cliente", async () => {
    const service = new BillingCheckoutIntentService(repository, priceResolver)
    const result = await service.createCheckout("token", "PIX")

    expect(result.amount).toBe(89.9)
    expect(priceResolver.resolvePrice).toHaveBeenCalledWith(expect.objectContaining({ method: "PIX" }))
    const payload = JSON.parse(requestMock.mock.calls[0]?.[1]?.body as string)
    expect(payload.items[0].value).toBe(89.9)
  })

  it("rejeita método inválido antes de chamar o Asaas", async () => {
    const service = new BillingCheckoutIntentService(repository, priceResolver)
    await expect(service.createCheckout("token", "BOLETO")).rejects.toThrow("Forma de pagamento inválida")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("marca reconciliação quando o checkout remoto divergente é reutilizado", async () => {
    repository.findReusableCheckout.mockResolvedValue({
      id: "intent-old",
      profileId: "profile-1",
      asaasCustomerId: "cus-1",
      asaasAccount: "primary",
      externalReference: "billing-intent:profile-1",
      billingType: "PIX",
      amount: 89.9,
      checkoutId: "checkout-old",
      checkoutUrl: "https://sandbox.asaas.com/checkoutSession/show?id=checkout-old",
    })
    requestMock.mockResolvedValue({
      id: "checkout-old",
      customer: "cus-other",
      externalReference: "billing-intent:profile-1",
      billingTypes: ["PIX"],
      items: [{ value: 89.9 }],
      status: "ACTIVE",
    })

    const service = new BillingCheckoutIntentService(repository, priceResolver)
    await expect(service.createCheckout("token", "PIX")).rejects.toThrow("reconciliação manual")
    expect(repository.markManualReconciliation).toHaveBeenCalledWith("intent-old", "remote_checkout_divergent")
  })

  it("substitui a intenção quando o preço do catálogo mudou", async () => {
    repository.findByTokenHash.mockResolvedValueOnce({
      id: "intent-old",
      profileId: "profile-1",
      asaasCustomerId: "cus-1",
      asaasAccount: "primary",
      productSlug: "crm",
      productId: null,
      cycle: "monthly",
      externalReference: "billing-intent:profile-1",
      status: "checkout_created",
      billingType: "PIX",
      amount: 79.9,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const service = new BillingCheckoutIntentService(repository, priceResolver)
    const result = await service.createCheckout("token", "PIX")

    expect(repository.markSuperseded).toHaveBeenCalledWith("intent-old")
    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(result.amount).toBe(89.9)
  })
})
