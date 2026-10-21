import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { createHash } from "node:crypto"

const consumeBillingRateLimit = mock(async (_key: string, _options: unknown) => ({ allowed: true, retryAfterSeconds: 1 }))
mock.module("@/lib/billing/billing-rate-limit", () => ({ consumeBillingRateLimit }))

const createPixCheckout = mock(async (_token: string, _input: unknown, _key: string) => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { adhesionId: "adh-1" },
}))
mock.module("@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase", () => ({
  backofficeAdhesionUseCase: { createPixCheckout },
}))

const { POST } = await import("./route")

const TOKEN = "token-secreto-123"
const TOKEN_KEY = `public-adhesion-pix-token:${createHash("sha256").update(TOKEN).digest("hex")}`
const env = process.env as Record<string, string | undefined>
const savedEnv = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL }

function pixRequest(headers: Record<string, string> = {}) {
  return new Request(`https://app.example.com/api/v1/public-adhesions/${TOKEN}/pix`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ fullName: "Maria", email: "m@example.com", phone: "11999999999", cpfCnpj: "52998224725", idempotencyKey: "k" }),
  })
}

const call = (request: Request) =>
  POST(request as never, { params: Promise.resolve({ token: TOKEN }) })

beforeEach(() => {
  consumeBillingRateLimit.mockClear()
  consumeBillingRateLimit.mockImplementation(async () => ({ allowed: true, retryAfterSeconds: 1 }))
  createPixCheckout.mockClear()
})
afterEach(() => {
  env.NODE_ENV = savedEnv.NODE_ENV
  if (savedEnv.VERCEL === undefined) delete env.VERCEL
  else env.VERCEL = savedEnv.VERCEL
})

describe("POST /api/v1/public-adhesions/[token]/pix — rate limit", () => {
  it("usa o IP assinado pela Vercel e ignora x-forwarded-for forjado", async () => {
    env.NODE_ENV = "production"
    env.VERCEL = "1"

    const response = await call(
      pixRequest({ "x-vercel-id": "gru1::abc", "x-vercel-forwarded-for": "198.51.100.4", "x-forwarded-for": "6.6.6.6" }),
    )

    expect(response.status).toBe(201)
    const keys = consumeBillingRateLimit.mock.calls.map((args) => args[0])
    expect(keys).toContain("public-adhesion-pix:198.51.100.4")
    expect(keys.join(",")).not.toContain("6.6.6.6")
  })

  it("sem IP confiável cai num balde compartilhado (falha fechada), nunca no cabeçalho forjável", async () => {
    env.NODE_ENV = "production"
    delete env.VERCEL

    await call(pixRequest({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" }))

    const keys = consumeBillingRateLimit.mock.calls.map((args) => args[0])
    expect(keys).toContain("public-adhesion-pix:untrusted-shared")
    expect(keys.join(",")).not.toMatch(/6\.6\.6\.6|7\.7\.7\.7/)
  })

  it("limita também por token (hash) e responde 429 com Retry-After sem criar a cobrança", async () => {
    consumeBillingRateLimit.mockImplementation(async (key: string) =>
      key === TOKEN_KEY ? { allowed: false, retryAfterSeconds: 42 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await call(pixRequest())

    expect(consumeBillingRateLimit.mock.calls.map((args) => args[0])).toContain(TOKEN_KEY)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("42")
    expect(createPixCheckout).not.toHaveBeenCalled()
  })

  it("IP acima do limite bloqueia antes de consumir a cota do token", async () => {
    consumeBillingRateLimit.mockImplementation(async (key: string) =>
      key.startsWith("public-adhesion-pix:") ? { allowed: false, retryAfterSeconds: 9 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await call(pixRequest())

    expect(response.status).toBe(429)
    expect(consumeBillingRateLimit.mock.calls.map((args) => args[0])).not.toContain(TOKEN_KEY)
    expect(createPixCheckout).not.toHaveBeenCalled()
  })

  it("dentro dos limites repassa o token, o pagador e a chave de idempotência ao caso de uso", async () => {
    const response = await call(pixRequest())

    expect(response.status).toBe(201)
    expect(createPixCheckout).toHaveBeenCalledWith(
      TOKEN,
      { fullName: "Maria", email: "m@example.com", phone: "11999999999", cpfCnpj: "52998224725" },
      "k",
    )
  })
})
