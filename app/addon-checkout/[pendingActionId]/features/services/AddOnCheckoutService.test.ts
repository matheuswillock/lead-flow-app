import { afterEach, describe, expect, it } from "bun:test"
import { AddOnCheckoutServiceImpl } from "./AddOnCheckoutService"
import type { KeyValueStorage } from "../utils/platformPixPayment"
import type { AddOnCheckoutSubmitInput } from "../context/AddOnCheckoutTypes"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function makeStorage(): KeyValueStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

const input: AddOnCheckoutSubmitInput = {
  billingType: "PIX",
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999998888",
  cpfCnpj: "12345678901",
  postalCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
  installments: 1,
  cardHolderName: "",
  cardNumber: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  cardCcv: "",
}

function mockFetch(response: { ok?: boolean; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return { ok: response.ok ?? true, json: async () => response.body } as Response
  }) as unknown as typeof fetch
  return calls
}

const startedPayment = {
  isValid: true,
  errorMessages: [],
  result: {
    amountInCents: 10000,
    pix: { brCode: "000201", brCodeBase64: "AAAA", expiresAt: "2999-01-01T00:00:00.000Z" },
  },
}

describe("AddOnCheckoutService.createPlatformPixPayment", () => {
  it("chama o endpoint genérico com Idempotency-Key e body PIX", async () => {
    const calls = mockFetch({ body: startedPayment })
    const service = new AddOnCheckoutServiceImpl(makeStorage, () => "uuid-1")

    const data = await service.createPlatformPixPayment("purchase-1", input)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toEndWith("/payment-provider-payment/purchase-1")
    const init = calls[0].init
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("platform-pix:purchase-1:uuid-1")
    expect(JSON.parse(init.body as string)).toEqual({
      method: "PIX",
      customer: {
        name: "Maria Souza",
        email: "maria@example.com",
        taxId: "12345678901",
        cellphone: "11999998888",
      },
    })
    expect(data.pix.payload).toBe("000201")
    expect(data.pix.encodedImage).toBe("data:image/png;base64,AAAA")
    expect(data.amount).toBe(100)
  })

  it("reutiliza a chave em chamadas repetidas da mesma compra", async () => {
    const calls = mockFetch({ body: startedPayment })
    const storage = makeStorage()
    let n = 0
    const service = new AddOnCheckoutServiceImpl(() => storage, () => `uuid-${++n}`)

    await service.createPlatformPixPayment("purchase-1", input)
    await service.createPlatformPixPayment("purchase-1", input)

    const keys = calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"])
    expect(keys[0]).toBe(keys[1])
  })

  it("propaga a mensagem de erro do backend", async () => {
    mockFetch({ ok: false, body: { isValid: false, errorMessages: ["Dados do cliente incompletos"] } })
    const service = new AddOnCheckoutServiceImpl(makeStorage, () => "u")

    await expect(service.createPlatformPixPayment("purchase-1", input)).rejects.toThrow(
      "Dados do cliente incompletos"
    )
  })
})

describe("AddOnCheckoutService.createPlatformCardPayment", () => {
  it("envia somente o token efêmero e os dados do cliente ao provider", async () => {
    const calls = mockFetch({ body: { isValid: true, result: { status: "PENDING", amountInCents: 10000 } } })
    const service = new AddOnCheckoutServiceImpl(makeStorage, () => "uuid-card")
    await service.createPlatformCardPayment("purchase-1", { ...input, billingType: "CREDIT_CARD", cardToken: "ctok_once" })
    expect(calls[0].init.headers).toMatchObject({ "Idempotency-Key": "platform-card:purchase-1:uuid-card" })
    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toMatchObject({ method: "CARD", cardToken: "ctok_once", installments: 1 })
    expect(body.customer).toEqual({ name: input.fullName, email: input.email, taxId: input.cpfCnpj, cellphone: input.phone })
    expect(body).not.toHaveProperty("creditCard")
  })
})

describe("AddOnCheckoutService.createPayment (cobrança de PendingAction)", () => {
  // Achado Codex (PR #1407, P2): o cartão precisa seguir como token; dados crus do cartão não saem do navegador.
  it("cartão envia o token ao backend e nunca os dados crus do cartão", async () => {
    const calls = mockFetch({ body: { isValid: true, errorMessages: [], result: { paymentId: "provider-bill_1" } } })
    const service = new AddOnCheckoutServiceImpl(makeStorage, () => "uuid-pa")
    await service.createPayment("pa-1", {
      ...input,
      billingType: "CREDIT_CARD",
      installments: 2,
      cardToken: "tok_123",
      cardHolderName: "MARIA SOUZA",
      cardNumber: "4111111111111111",
      cardExpiryMonth: "12",
      cardExpiryYear: "2030",
      cardCcv: "123",
    })

    const rawBody = String(calls[0].init.body)
    const body = JSON.parse(rawBody)
    expect(body).toMatchObject({ billingType: "CREDIT_CARD", cardToken: "tok_123", installments: 2 })
    expect(body).not.toHaveProperty("creditCard")
    expect(rawBody).not.toContain("4111111111111111")
  })
})
