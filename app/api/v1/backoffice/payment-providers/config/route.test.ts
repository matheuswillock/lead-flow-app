import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))

type AccessResult =
  | { access: Record<string, unknown>; error?: never; status?: never }
  | { access?: never; error: Output; status: number }
let accessResult: AccessResult

mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: mock(async () => accessResult),
}))
mock.module("@/lib/billing/billing-rate-limit", () => ({
  consumeBillingRateLimit: mock(async () => ({ allowed: true, retryAfterSeconds: 1 })),
}))

const list = mock(async (_input: unknown) => new Output(true, [], [], [{ id: "i1" }]))
const create = mock(async (_input: unknown, _actor: unknown) => new Output(true, ["ok"], [], { id: "i1" }))
const update = mock(async (_input: unknown, _actor: unknown) => new Output(true, ["ok"], [], { id: "i1" }))
mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderConfigUseCase: { list, create, update },
  paymentProviderHealthCheckUseCase: {},
}))

const { GET, POST, PUT } = await import("./route")

const ID = "11111111-1111-4111-8111-111111111111"
const URL_BASE = "http://localhost/api/v1/backoffice/payment-providers/config"

function write(method: "POST" | "PUT", body: unknown, origin: string | null = "http://localhost") {
  const headers: Record<string, string> = { "Content-Type": "application/json", host: "localhost" }
  if (origin) headers.origin = origin
  return new NextRequest(URL_BASE, { method, headers, body: JSON.stringify(body) })
}

function grant(isOperator: boolean) {
  accessResult = {
    access: {
      supabaseId: "s1",
      profileId: "profile-1",
      backofficeUserId: "bo-1",
      backofficeEmail: "dono@corretorstudio.com",
      fullAccess: !isOperator,
      isOperator,
    },
  }
}

beforeEach(() => {
  for (const fn of [list, create, update]) fn.mockClear()
  grant(false)
})

describe("GET config", () => {
  it("401 sem autenticação", async () => {
    accessResult = { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
    const response = await GET(new NextRequest(`${URL_BASE}?environment=DEV`))
    expect(response.status).toBe(401)
    expect(list).not.toHaveBeenCalled()
  })

  it("operator pode ler; ambiente inválido é 400", async () => {
    grant(true)
    expect((await GET(new NextRequest(`${URL_BASE}?environment=DEV`))).status).toBe(200)
    expect((await GET(new NextRequest(`${URL_BASE}?environment=X`))).status).toBe(400)
  })
})

describe("POST config (criar instância)", () => {
  const body = { providerKey: "ASAAS", environment: "DEV", externalAccountContext: "primary", displayName: "Asaas" }

  it("403 para operator e para Origin de outro site", async () => {
    grant(true)
    expect((await POST(write("POST", body))).status).toBe(403)
    grant(false)
    expect((await POST(write("POST", body, "https://evil.com"))).status).toBe(403)
    expect((await POST(write("POST", body, null))).status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })

  it("400 para payload inválido", async () => {
    expect((await POST(write("POST", { ...body, providerKey: "X" }))).status).toBe(400)
    expect((await POST(write("POST", { ...body, displayName: 5 }))).status).toBe(400)
  })

  it("201 com ator e 409 em duplicata", async () => {
    const response = await POST(write("POST", body))
    expect(response.status).toBe(201)
    expect(create.mock.calls[0][1]).toMatchObject({ profileId: "profile-1", backofficeUserId: "bo-1" })
    create.mockResolvedValueOnce(new Output(false, [], ["Já existe"], { errorCode: "CONFLICT" }))
    expect((await POST(write("POST", body))).status).toBe(409)
  })
})

describe("PUT config", () => {
  it("passa o ATOR ao use case e aceita o corpo novo", async () => {
    const response = await PUT(write("PUT", { id: ID, expectedRevision: 2, killSwitch: true, settings: { cardEnabled: false } }))
    expect(response.status).toBe(200)
    const [input, actor] = update.mock.calls[0]
    expect(input).toMatchObject({ id: ID, expectedRevision: 2, killSwitch: true, settings: { cardEnabled: false } })
    expect(actor).toEqual({ profileId: "profile-1", backofficeUserId: "bo-1", backofficeEmail: "dono@corretorstudio.com" })
  })

  it("mantém compatibilidade com o corpo antigo { provider, environment, patch }", async () => {
    await PUT(write("PUT", { provider: "ABACATE_PAY", environment: "PRODUCTION", patch: { expectedRevision: 4, enabled: true } }))
    expect(update.mock.calls[0][0]).toMatchObject({ provider: "ABACATE_PAY", environment: "PRODUCTION", expectedRevision: 4, enabled: true })
  })

  it("400 para tipos inválidos e id que não é uuid", async () => {
    expect((await PUT(write("PUT", { id: "x", expectedRevision: 1 }))).status).toBe(400)
    expect((await PUT(write("PUT", { id: ID, expectedRevision: "1" }))).status).toBe(400)
    expect((await PUT(write("PUT", { id: ID, expectedRevision: 1, rolloutState: "NOPE" }))).status).toBe(400)
    expect((await PUT(write("PUT", { id: ID, expectedRevision: 1, enabled: "yes" }))).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("409 em revisão desatualizada, 404 quando não existe, 403 para operator", async () => {
    update.mockResolvedValueOnce(new Output(false, [], ["desatualizada"], { errorCode: "CONFLICT" }))
    expect((await PUT(write("PUT", { id: ID, expectedRevision: 1 }))).status).toBe(409)
    update.mockResolvedValueOnce(new Output(false, [], ["nf"], { errorCode: "NOT_FOUND" }))
    expect((await PUT(write("PUT", { id: ID, expectedRevision: 1 }))).status).toBe(404)
    grant(true)
    expect((await PUT(write("PUT", { id: ID, expectedRevision: 1 }))).status).toBe(403)
  })
})
