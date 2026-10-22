import { describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse, after, connection: mock(async () => undefined) }))
mock.module("server-only", () => ({}))
let accessResult: Record<string, unknown> = {
  access: { profileId: "p", backofficeUserId: null, backofficeEmail: "a@b.c", fullAccess: false, isOperator: true },
}
mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({ getBackofficeAccess: mock(async () => accessResult) }))
const history = mock(async (_input: unknown) => new Output(true, [], [], { items: [] }))
mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderConfigUseCase: { history },
  paymentProviderHealthCheckUseCase: {},
}))
const { GET } = await import("./route")
const ID = "11111111-1111-4111-8111-111111111111"

describe("GET history", () => {
  it("lê o histórico da instância e rejeita configId inválido", async () => {
    expect((await GET(new NextRequest(`http://localhost/x?configId=${ID}`))).status).toBe(200)
    expect(history).toHaveBeenCalledWith({ configId: ID })
    expect((await GET(new NextRequest("http://localhost/x?configId=zzz"))).status).toBe(400)
  })

  it("404 quando a instância não existe", async () => {
    history.mockResolvedValueOnce(new Output(false, [], ["nf"], { errorCode: "NOT_FOUND" }))
    expect((await GET(new NextRequest(`http://localhost/x?configId=${ID}`))).status).toBe(404)
  })

  it("401 sem autenticação", async () => {
    accessResult = { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
    expect((await GET(new NextRequest(`http://localhost/x?configId=${ID}`))).status).toBe(401)
  })
})
