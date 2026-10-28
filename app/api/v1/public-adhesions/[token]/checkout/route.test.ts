import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { createPublicAdhesionCheckoutHandler } from "./checkoutHandler"

const TOKEN = "token-secreto-123"
const TOKEN_KEY = `public-adhesion-checkout-token:${createHash("sha256").update(TOKEN).digest("hex")}`
const IP_KEY = "public-adhesion-checkout:198.51.100.4"

const getPublicDetails = mock(
  async (_token: string): Promise<Output> => new Output(true, [], [], { pixProvider: "ASAAS" }),
)
const createCheckout = mock(
  async (_token: string, _input: unknown): Promise<Output> => new Output(true, [], [], { paymentId: "pay_1" }),
)
const consumeRateLimit = mock(async (_key: string, _options: unknown) => ({ allowed: true, retryAfterSeconds: 1 }))
const rejectUnavailableBillingType = mock(async (_billingType: unknown): Promise<NextResponse | null> => null)

const handler = createPublicAdhesionCheckoutHandler({
  useCase: { getPublicDetails, createCheckout },
  consumeRateLimit,
  rejectUnavailableBillingType,
})

const env = process.env as Record<string, string | undefined>

function checkoutRequest(body: Record<string, unknown>) {
  return new Request(`https://app.example.com/api/v1/public-adhesions/${TOKEN}/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-id": "gru1::abc",
      "x-vercel-forwarded-for": "198.51.100.4",
    },
    body: JSON.stringify(body),
  })
}

const call = (body: Record<string, unknown>) => handler(checkoutRequest(body) as never, { params: Promise.resolve({ token: TOKEN }) })

beforeEach(() => {
  env.VERCEL = "1"
  env.NODE_ENV = "production"
  getPublicDetails.mockClear()
  getPublicDetails.mockImplementation(async () => new Output(true, [], [], { pixProvider: "ASAAS" }))
  createCheckout.mockClear()
  consumeRateLimit.mockClear()
  consumeRateLimit.mockImplementation(async () => ({ allowed: true, retryAfterSeconds: 1 }))
  rejectUnavailableBillingType.mockClear()
  rejectUnavailableBillingType.mockImplementation(async () => null)
})

describe("POST /api/v1/public-adhesions/[token]/checkout — cartão (A5a)", () => {
  it("cartão indisponível: 422 PAYMENT_METHOD_UNAVAILABLE sem criar cobrança", async () => {
    rejectUnavailableBillingType.mockImplementation(async () =>
      NextResponse.json(new Output(false, [], ["Cartão indisponível"], null), { status: 422 }),
    )

    const response = await call({ billingType: "CREDIT_CARD" })

    expect(response.status).toBe(422)
    expect(rejectUnavailableBillingType).toHaveBeenCalledWith("CREDIT_CARD")
    expect(createCheckout).not.toHaveBeenCalled()
  })

  it("cartão disponível segue para o caso de uso", async () => {
    const response = await call({ billingType: "CREDIT_CARD", creditCard: { number: "1" } })

    expect(response.status).toBe(201)
    expect(createCheckout).toHaveBeenCalledTimes(1)
  })

  it("PIX não consulta a disponibilidade de cartão", async () => {
    await call({ billingType: "PIX" })

    expect(rejectUnavailableBillingType).not.toHaveBeenCalled()
  })

  it("billingType inválido: 400 sem cobrança", async () => {
    const response = await call({ billingType: "BOLETO" })

    expect(response.status).toBe(400)
    expect(createCheckout).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/public-adhesions/[token]/checkout — PIX do Abacate (A5b)", () => {
  it("adesão cujo PIX segue o Abacate: 409 e NENHUMA cobrança é criada no Asaas", async () => {
    getPublicDetails.mockImplementation(async () => new Output(true, [], [], { pixProvider: "ABACATE_PAY" }))

    const response = await call({ billingType: "PIX" })

    expect(response.status).toBe(409)
    expect(((await response.json()) as Output).errorMessages).toEqual([
      "Use o pagamento por PIX da página de adesão.",
    ])
    expect(getPublicDetails).toHaveBeenCalledWith(TOKEN)
    expect(createCheckout).not.toHaveBeenCalled()
  })

  it("adesão com parcela Asaas pendente continua gerando o PIX pelo Asaas", async () => {
    const response = await call({ billingType: "PIX", fullName: "Maria" })

    expect(response.status).toBe(201)
    expect(createCheckout).toHaveBeenCalledTimes(1)
    expect(createCheckout.mock.calls[0]?.[0]).toBe(TOKEN)
  })

  it("token inválido não é bloqueado pela guarda: o caso de uso responde como antes (400)", async () => {
    getPublicDetails.mockImplementation(async () => new Output(false, [], ["Token inválido: expired"], { tokenStatus: "expired" }))
    createCheckout.mockImplementationOnce(async () => new Output(false, [], ["Token inválido: expired"], null))

    const response = await call({ billingType: "PIX" })

    expect(response.status).toBe(400)
    expect(createCheckout).toHaveBeenCalledTimes(1)
  })

  it("cartão não passa pela consulta de provider do PIX", async () => {
    await call({ billingType: "CREDIT_CARD" })

    expect(getPublicDetails).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/public-adhesions/[token]/checkout — rate limit (A5c)", () => {
  it("consome IP (20/10 min) e token em hash (10/10 min)", async () => {
    await call({ billingType: "PIX" })

    expect(consumeRateLimit.mock.calls).toEqual([
      [IP_KEY, { limit: 20, windowMs: 10 * 60_000 }],
      [TOKEN_KEY, { limit: 10, windowMs: 10 * 60_000 }],
    ])
  })

  it("429 por token com Retry-After, antes de qualquer cobrança", async () => {
    consumeRateLimit.mockImplementation(async (key: string) =>
      key === TOKEN_KEY ? { allowed: false, retryAfterSeconds: 42 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await call({ billingType: "PIX" })

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("42")
    expect(createCheckout).not.toHaveBeenCalled()
    expect(getPublicDetails).not.toHaveBeenCalled()
  })

  it("429 por IP bloqueia antes de consumir a cota do token", async () => {
    consumeRateLimit.mockImplementation(async (key: string) =>
      key === IP_KEY ? { allowed: false, retryAfterSeconds: 9 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await call({ billingType: "CREDIT_CARD" })

    expect(response.status).toBe(429)
    expect(consumeRateLimit.mock.calls.map((args) => args[0])).not.toContain(TOKEN_KEY)
    expect(createCheckout).not.toHaveBeenCalled()
  })

  it("sem IP confiável usa o balde compartilhado", async () => {
    env.VERCEL = undefined

    await call({ billingType: "PIX" })

    expect(consumeRateLimit.mock.calls.map((args) => args[0])).toContain("public-adhesion-checkout:untrusted-shared")
  })
})
