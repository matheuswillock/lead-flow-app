import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const teamAccessMock = mock(async () => ({
  access: {
    profileId: "profile-1",
    managerId: "manager-1",
    teamMember: { role: "manager", functions: [] },
  },
}))

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: teamAccessMock,
  hasDelegatedTeamManagementAccess: () => true,
}))

const executeMock = mock(async () => new Output(true, ["Time criado com sucesso sem cobrança adicional"], [], { created: true }))

mock.module("@/app/api/useCases/teamCheckout/CreateTeamCheckoutUseCase", () => ({
  createTeamCheckoutUseCase: { execute: executeMock },
}))

const consumeBillingRateLimitMock = mock(async () => ({ allowed: true, retryAfterSeconds: 1 }))

mock.module("@/lib/billing/billing-rate-limit", () => ({
  consumeBillingRateLimit: consumeBillingRateLimitMock,
  BILLING_RATE_LIMIT_DEFAULTS: {
    webhookInvalidToken: { limit: 30, windowMs: 5 * 60_000 },
    checkoutCreate: { limit: 10, windowMs: 60_000 },
    backofficePricing: { limit: 20, windowMs: 60_000 },
  },
}))

const { POST } = await import("./route")

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/teams/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-supabase-user-id": "supa-1" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  executeMock.mockClear()
  consumeBillingRateLimitMock.mockReset()
  consumeBillingRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
})

describe("POST /teams/payments/create — rota fina (refactor pós-allowlist)", () => {
  it("sem x-supabase-user-id → 401, UseCase não invocado", async () => {
    const request = new NextRequest("http://localhost/api/v1/teams/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo Time" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("nome do time < 2 caracteres → 400, UseCase não invocado", async () => {
    const response = await POST(makeRequest({ name: "A" }))

    expect(response.status).toBe(400)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("acima do teto de rate limit → 429 com Retry-After, UseCase não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 })

    const response = await POST(makeRequest({ name: "Novo Time" }))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("17")
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("fluxo feliz → delega ao UseCase com o input correto, 201", async () => {
    const response = await POST(makeRequest({ name: "Novo Time", billingType: "CREDIT_CARD" }))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.result.created).toBe(true)
    expect(executeMock).toHaveBeenCalledWith({
      requesterProfileId: "profile-1",
      masterProfileId: "manager-1",
      teamName: "Novo Time",
      billingType: "CREDIT_CARD",
      requesterRole: "manager",
      requesterFunctions: [],
    })
  })

  it("UseCase devolve 'Perfil não encontrado' → 404", async () => {
    executeMock.mockResolvedValueOnce(new Output(false, [], ["Perfil não encontrado"], null))

    const response = await POST(makeRequest({ name: "Novo Time" }))

    expect(response.status).toBe(404)
  })

  it("UseCase devolve outra falha de validação → 400", async () => {
    executeMock.mockResolvedValueOnce(new Output(false, [], ["Master nao possui assinatura ativa"], null))

    const response = await POST(makeRequest({ name: "Novo Time" }))

    expect(response.status).toBe(400)
  })

  it("pending action criada → 201 com pendingActionId/checkoutUrl", async () => {
    executeMock.mockResolvedValueOnce(
      new Output(true, ["Cobrança pendente criada. Um link de pagamento foi enviado."], [], {
        pendingActionId: "pa-1",
        checkoutUrl: "https://app.local/addon-checkout/pa-1",
      })
    )

    const response = await POST(makeRequest({ name: "Novo Time" }))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.result.pendingActionId).toBe("pa-1")
  })
})
