import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { createHash } from "node:crypto"
import { Output } from "@/lib/output"
import type { ISelfCheckoutUseCase } from "@/app/api/useCases/selfCheckout/ISelfCheckoutUseCase"
import { createSelfCheckoutOptionsHandler, createSelfCheckoutPostHandler } from "./handlers"

const GENERIC_INVALID = "Dados inválidos para submissão."
const EMAIL = "maria@example.com"
const EMAIL_KEY = `public-self-checkout-email:${createHash("sha256").update(EMAIL).digest("hex")}`
const IP_KEY = "public-self-checkout-ip:198.51.100.4"

const validBody = {
  fullName: "Maria Souza",
  email: "  Maria@Example.com ",
  phone: "(11) 99999-9999",
  cycle: "monthly",
}

const create = mock(async (_input: unknown): Promise<Output> => new Output(true, [], [], { token: "tok-1" }))
const getOptions = mock(async (): Promise<Output> => new Output(true, [], [], { product: { name: "CRM" }, cycles: [] }))
const useCase: ISelfCheckoutUseCase = { create, getOptions }

const consumeRateLimit = mock(async (_key: string, _options: unknown) => ({ allowed: true, retryAfterSeconds: 1 }))
const post = createSelfCheckoutPostHandler({ useCase, consumeRateLimit })

const SAFE_HEADERS = { "x-vercel-id": "gru1::abc", "x-vercel-forwarded-for": "198.51.100.4" }
const env = process.env as Record<string, string | undefined>

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://app.example.com/api/v1/public-self-checkout", {
    method: "POST",
    headers: { "content-type": "application/json", host: "app.example.com", ...SAFE_HEADERS, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function json(response: Response) {
  return (await response.json()) as Output
}

let originalAppUrl: string | undefined

beforeEach(() => {
  // A CI não carrega .env: sem a URL da aplicação o guard de origem libera tudo.
  originalAppUrl = env.NEXT_PUBLIC_APP_URL
  env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
  env.VERCEL = "1"
  env.NODE_ENV = "production"
  create.mockClear()
  create.mockImplementation(async () => new Output(true, [], [], { token: "tok-1" }))
  getOptions.mockClear()
  consumeRateLimit.mockClear()
  consumeRateLimit.mockImplementation(async () => ({ allowed: true, retryAfterSeconds: 1 }))
})

afterEach(() => {
  if (originalAppUrl === undefined) delete env.NEXT_PUBLIC_APP_URL
  else env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe("POST /api/v1/public-self-checkout", () => {
  it("200 com o token e repassa ao caso de uso os campos validados, sem o honeypot", async () => {
    const response = await post(request(validBody))

    expect(response.status).toBe(200)
    const body = await json(response)
    expect(body.isValid).toBe(true)
    expect(body.result).toEqual({ token: "tok-1" })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[0]).toEqual({
      fullName: "Maria Souza",
      email: EMAIL,
      phone: "(11) 99999-9999",
      cycle: "monthly",
    })
  })

  it("corpo ilegível ou não-objeto: 400 sem criar nada", async () => {
    for (const raw of ["{nao-json", "null", '"texto"']) {
      const response = await post(request(raw))
      expect(response.status).toBe(400)
    }
    expect(create).not.toHaveBeenCalled()
  })

  it("400 Zod com as mensagens dos campos inválidos", async () => {
    const response = await post(request({ ...validBody, email: "invalido", cycle: "lifetime", fullName: "ab" }))

    expect(response.status).toBe(400)
    const body = await json(response)
    expect(body.isValid).toBe(false)
    expect(body.errorMessages).toEqual(
      expect.arrayContaining(["E-mail inválido.", "Selecione um plano.", "Informe seu nome completo."]),
    )
    expect(create).not.toHaveBeenCalled()
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it("honeypot preenchido: 400 genérico, sem revelar o motivo e sem criar nada", async () => {
    const response = await post(request({ ...validBody, website: "http://spam.example" }))

    expect(response.status).toBe(400)
    const body = await json(response)
    expect(body.errorMessages).toEqual([GENERIC_INVALID])
    expect(JSON.stringify(body)).not.toMatch(/honeypot|website|bot/i)
    expect(create).not.toHaveBeenCalled()
  })

  it("honeypot vazio é aceito (campo oculto sem preenchimento)", async () => {
    const response = await post(request({ ...validBody, website: "" }))

    expect(response.status).toBe(200)
  })

  it("padrão de SQL injection nos campos de texto: 400 genérico", async () => {
    const response = await post(request({ ...validBody, fullName: "Maria'; DROP TABLE users;--" }))

    expect(response.status).toBe(400)
    expect((await json(response)).errorMessages).toEqual([GENERIC_INVALID])
    expect(create).not.toHaveBeenCalled()
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it("origem de terceiro: 400 e nenhuma cota consumida", async () => {
    const response = await post(request(validBody, { origin: "https://evil.example" }))

    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it("origem da própria aplicação passa", async () => {
    const response = await post(request(validBody, { origin: "https://app.example.com" }))

    expect(response.status).toBe(200)
  })

  it("consome dois baldes: IP (5/10 min) e e-mail normalizado em hash (3/10 min)", async () => {
    await post(request(validBody))

    expect(consumeRateLimit.mock.calls).toEqual([
      [IP_KEY, { limit: 5, windowMs: 10 * 60_000 }],
      [EMAIL_KEY, { limit: 3, windowMs: 10 * 60_000 }],
    ])
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain("example.com")
  })

  it("429 por IP com Retry-After, sem consumir o balde do e-mail", async () => {
    consumeRateLimit.mockImplementation(async (key: string) =>
      key === IP_KEY ? { allowed: false, retryAfterSeconds: 37 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await post(request(validBody))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("37")
    expect(consumeRateLimit.mock.calls.map((call) => call[0])).not.toContain(EMAIL_KEY)
    expect(create).not.toHaveBeenCalled()
  })

  it("429 por e-mail com Retry-After", async () => {
    consumeRateLimit.mockImplementation(async (key: string) =>
      key === EMAIL_KEY ? { allowed: false, retryAfterSeconds: 120 } : { allowed: true, retryAfterSeconds: 1 },
    )

    const response = await post(request(validBody))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("120")
    expect(create).not.toHaveBeenCalled()
  })

  it("e-mail com caixa e espaços diferentes cai no mesmo balde", async () => {
    await post(request({ ...validBody, email: "MARIA@example.COM" }))

    expect(consumeRateLimit.mock.calls.map((call) => call[0])).toContain(EMAIL_KEY)
  })

  it("sem IP confiável cai no balde compartilhado, nunca no cabeçalho forjável", async () => {
    env.VERCEL = undefined
    await post(request(validBody, { "x-vercel-id": "", "x-forwarded-for": "6.6.6.6" }))

    const keys = consumeRateLimit.mock.calls.map((call) => call[0])
    expect(keys).toContain("public-self-checkout-ip:untrusted-shared")
    expect(keys.join(",")).not.toContain("6.6.6.6")
  })

  it.each([
    ["PROVIDER_UNAVAILABLE", 503, "O pagamento está temporariamente indisponível. Tente novamente em instantes."],
    ["ACCOUNT_EXISTS", 409, "Já existe uma conta cadastrada com este e-mail."],
    ["CYCLE_UNAVAILABLE", 422, "Plano indisponível."],
    ["RATE_LIMITED", 429, "Muitas tentativas."],
  ] as const)("mapeia %s do caso de uso para HTTP %i", async (code, status, message) => {
    create.mockImplementation(async () => new Output(false, [], [message], { code }))

    const response = await post(request(validBody))

    expect(response.status).toBe(status)
    expect((await json(response)).errorMessages).toEqual([message])
  })

  it("Output inválido sem código: 500", async () => {
    create.mockImplementation(async () => new Output(false, [], ["Falha"], null))

    expect((await post(request(validBody))).status).toBe(500)
  })

  it("exceção inesperada: 500 genérico sem vazar a causa", async () => {
    const original = console.error
    console.error = () => undefined
    try {
      create.mockImplementation(async () => {
        throw new Error("falha com maria@example.com")
      })

      const response = await post(request(validBody))

      expect(response.status).toBe(500)
      expect(JSON.stringify(await json(response))).not.toContain("maria@example.com")
    } finally {
      console.error = original
    }
  })
})

describe("GET /api/v1/public-self-checkout/options", () => {
  const get = createSelfCheckoutOptionsHandler(useCase)

  it("200 com as opções e cache curto (<= 30 s)", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    const body = await json(response)
    expect(body.result).toEqual({ product: { name: "CRM" }, cycles: [] })
    const cacheControl = response.headers.get("Cache-Control") ?? ""
    const sMaxAge = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1] ?? "0")
    expect(sMaxAge).toBeGreaterThan(0)
    expect(sMaxAge).toBeLessThanOrEqual(30)
    expect(cacheControl).not.toMatch(/stale-while-revalidate=([3-9]\d|\d{3,})/)
  })

  it("Output inválido: 500 sem cache", async () => {
    getOptions.mockImplementationOnce(async () => new Output(false, [], ["Falha"], null))

    const response = await get()

    expect(response.status).toBe(500)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("exceção inesperada: 500", async () => {
    const original = console.error
    console.error = () => undefined
    try {
      getOptions.mockImplementationOnce(async () => {
        throw new Error("boom")
      })

      expect((await get()).status).toBe(500)
    } finally {
      console.error = original
    }
  })
})
