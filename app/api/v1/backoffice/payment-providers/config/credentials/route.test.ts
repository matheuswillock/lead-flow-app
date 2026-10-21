import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse, after, connection: mock(async () => undefined) }))
mock.module("server-only", () => ({}))

let accessResult: Record<string, unknown>
mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: mock(async () => accessResult),
}))
const rateLimit = mock(async (_key: string, _options: unknown) => ({ allowed: true, retryAfterSeconds: 7 }))
mock.module("@/lib/billing/billing-rate-limit", () => ({ consumeBillingRateLimit: rateLimit }))

const VIEW = { id: "i1", credentials: [{ key: "API_KEY", isSet: true, last4: "wxyz" }] }
const setCredential = mock(async (_input: unknown, _actor: unknown) => new Output(true, ["ok"], [], VIEW))
const deleteCredential = mock(async (_input: unknown, _actor: unknown) => new Output(true, ["ok"], [], VIEW))
mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderConfigUseCase: { setCredential, deleteCredential },
  paymentProviderHealthCheckUseCase: {},
}))

const { PUT, DELETE } = await import("./route")
const ID = "11111111-1111-4111-8111-111111111111"
const SECRET = "sk_live_NEVER_ECHO_THIS_VALUE_123456"
const BASE = "http://localhost/api/v1/backoffice/payment-providers/config/credentials"

function put(body: unknown, origin: string | null = "http://localhost") {
  const headers: Record<string, string> = { "Content-Type": "application/json", host: "localhost" }
  if (origin) headers.origin = origin
  return new NextRequest(BASE, { method: "PUT", headers, body: JSON.stringify(body) })
}

beforeEach(() => {
  for (const fn of [setCredential, deleteCredential, rateLimit]) fn.mockClear()
  rateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 7 })
  accessResult = {
    access: { supabaseId: "s", profileId: "p1", backofficeUserId: "bo1", backofficeEmail: "a@b.c", fullAccess: true, isOperator: false },
  }
})

describe("PUT credentials", () => {
  it("NUNCA devolve o valor na resposta e passa o ator", async () => {
    const response = await PUT(put({ configId: ID, key: "API_KEY", value: SECRET }))
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).not.toContain(SECRET)
    expect(setCredential.mock.calls[0][1]).toMatchObject({ profileId: "p1" })
  })

  it("rejeita payload sem valor string, configId inválido; Origin cruzada é 403", async () => {
    expect((await PUT(put({ configId: ID, key: "API_KEY" }))).status).toBe(400)
    expect((await PUT(put({ configId: "x", key: "API_KEY", value: SECRET }))).status).toBe(400)
    expect((await PUT(put({ configId: ID, key: "API_KEY", value: SECRET }, "https://evil.com"))).status).toBe(403)
    expect(setCredential).not.toHaveBeenCalled()
  })

  it("operator é 403; limite de taxa estourado é 429 com Retry-After", async () => {
    accessResult = { access: { ...(accessResult.access as object), isOperator: true } }
    expect((await PUT(put({ configId: ID, key: "API_KEY", value: SECRET }))).status).toBe(403)
    accessResult = { access: { ...(accessResult.access as object), isOperator: false } }
    rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 })
    const limited = await PUT(put({ configId: ID, key: "API_KEY", value: SECRET }))
    expect(limited.status).toBe(429)
    expect(limited.headers.get("Retry-After")).toBe("42")
    expect(setCredential).not.toHaveBeenCalled()
  })

  it("valor inválido (use case) vira 400 sem ecoar o valor", async () => {
    setCredential.mockResolvedValueOnce(new Output(false, [], ["O valor da credencial não pode ser vazio"], { errorCode: "VALIDATION" }))
    const response = await PUT(put({ configId: ID, key: "API_KEY", value: "   " }))
    expect(response.status).toBe(400)
  })
})

describe("DELETE credentials", () => {
  const del = (query: string, origin: string | null = "http://localhost") =>
    new NextRequest(`${BASE}?${query}`, { method: "DELETE", headers: { host: "localhost", ...(origin ? { origin } : {}) } })

  it("remove pela query e exige Origin same-origin", async () => {
    expect((await DELETE(del(`configId=${ID}&key=API_KEY`))).status).toBe(200)
    expect(deleteCredential.mock.calls[0][0]).toEqual({ configId: ID, key: "API_KEY" })
    expect((await DELETE(del(`configId=${ID}&key=API_KEY`, "https://evil.com"))).status).toBe(403)
    expect((await DELETE(del("configId=x&key=API_KEY"))).status).toBe(400)
  })
})
