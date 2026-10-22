import { describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse, after, connection: mock(async () => undefined) }))
mock.module("server-only", () => ({}))
let accessResult: Record<string, unknown> = {
  access: { profileId: "p", backofficeUserId: null, backofficeEmail: "a@b.c", fullAccess: false, isOperator: true },
}
mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({ getBackofficeAccess: mock(async () => accessResult) }))
mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderHealthCheckUseCase: {},
  paymentProviderConfigUseCase: {
    listAdapters: () =>
      new Output(true, [], [], {
        adapters: [{ providerKey: "ASAAS", label: "Asaas", paymentCapable: false, credentialSchema: [] }],
      }),
  },
}))
const { GET } = await import("./route")

describe("GET adapters", () => {
  it("devolve adapters para qualquer acesso ao backoffice", async () => {
    const response = await GET(new NextRequest("http://localhost/x"))
    expect(response.status).toBe(200)
    expect((await response.json()).result.adapters[0].paymentCapable).toBe(false)
  })

  it("401 sem autenticação", async () => {
    accessResult = { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
    expect((await GET(new NextRequest("http://localhost/x"))).status).toBe(401)
  })
})
