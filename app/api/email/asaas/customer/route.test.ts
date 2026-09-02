import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.22/T-40.23 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E7/m8):
// rota sem consumidor vivo encontrado (grep + Postman-only) e sem
// autenticação — hardening mínimo (CRON_SECRET) enquanto a remoção
// definitiva aguarda autorização do owner (Open question 6).

const executeMock = mock(async (_input: unknown) => {
  const { Output } = await import("@/lib/output")
  return new Output(true, ["Cliente criado"], [], { asaasCustomerId: "cus_gateway_1" })
})

mock.module("@/app/api/useCases/asaasCustomer/CreateAsaasCustomerUseCase", () => ({
  createAsaasCustomerUseCase: { execute: executeMock },
}))

const { POST } = await import("./route")

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET

describe("POST /api/email/asaas/customer — autenticação mínima (E7/m8)", () => {
  beforeEach(() => {
    executeMock.mockClear()
    process.env.CRON_SECRET = "test-secret"
  })

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET
  })

  it("T-40.22: requisição sem credencial → 401, use case nunca é chamado", async () => {
    const request = new Request("https://example.test/api/email/asaas/customer", {
      method: "POST",
      body: JSON.stringify({ profileId: "profile-1" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("T-40.22b: credencial incorreta → 401", async () => {
    const request = new Request("https://example.test/api/email/asaas/customer", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
      body: JSON.stringify({ profileId: "profile-1" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("T-40.23: credencial correta → chama o use case (que já cria via AsaasCustomerGateway)", async () => {
    const request = new Request("https://example.test/api/email/asaas/customer", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
      body: JSON.stringify({ profileId: "profile-1", name: "Cliente" }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isValid).toBe(true)
    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ profileId: "profile-1" }))
  })

  it("CRON_SECRET não configurado → 401 mesmo com header presente (nunca abre por omissão)", async () => {
    delete process.env.CRON_SECRET
    const request = new Request("https://example.test/api/email/asaas/customer", {
      method: "POST",
      headers: { authorization: "Bearer anything" },
      body: JSON.stringify({ profileId: "profile-1" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })
})
