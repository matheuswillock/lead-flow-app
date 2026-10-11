import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))
mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({
  rethrowIfPrerenderInterrupted: () => undefined,
}))

const execute = mock(async () => new Output(true, [], [], { invoiceUrl: "secret" }))
mock.module("@/app/api/useCases/subscriptions/GetSubscriptionBySupabaseIdUseCase", () => ({
  getSubscriptionBySupabaseIdUseCase: { execute },
}))

const requireActiveAccountAccess = mock<
  (authenticatedSupabaseId: string) => Promise<NextResponse | null>
>(async () => null)
mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({
  requireActiveAccountAccess,
}))

const { GET } = await import("./route")

beforeEach(() => {
  execute.mockReset()
  execute.mockResolvedValue(new Output(true, [], [], { invoiceUrl: "secret" }))
  requireActiveAccountAccess.mockReset()
  requireActiveAccountAccess.mockResolvedValue(null)
})

describe("GET /api/v1/subscriptions/by-supabase/[supabaseId]", () => {
  it("recusa IDOR sem consultar a assinatura", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/subscriptions/by-supabase/other-user", {
        headers: { "x-supabase-user-id": "authenticated-user" },
      }),
      { params: Promise.resolve({ supabaseId: "other-user" }) }
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ result: null }))
    expect(execute).not.toHaveBeenCalled()
  })

  it("não expõe dados da assinatura para conta com acesso pausado", async () => {
    requireActiveAccountAccess.mockResolvedValue(
      NextResponse.json(new Output(false, [], ["O acesso desta conta está pausado."], null), {
        status: 403,
      })
    )

    const response = await GET(
      new NextRequest("http://localhost/api/v1/subscriptions/by-supabase/current-user", {
        headers: { "x-supabase-user-id": "current-user" },
      }),
      { params: Promise.resolve({ supabaseId: "current-user" }) }
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ result: null }))
    expect(execute).not.toHaveBeenCalled()
  })
})
