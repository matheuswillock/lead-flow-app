import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))
mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({
  rethrowIfPrerenderInterrupted: () => undefined,
}))

const executeForAuthenticatedSupabaseId = mock(async () =>
  new Output(true, ["Projeção de cobrança calculada"], [], { billingOwnerId: "owner-1" })
)

mock.module("@/app/api/useCases/billingQuote/billingQuoteFactory", () => ({
  billingQuoteUseCase: { executeForAuthenticatedSupabaseId },
}))

const requireActiveAccountAccess = mock<
  (authenticatedSupabaseId: string) => Promise<NextResponse | null>
>(async () => null)

mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({
  requireActiveAccountAccess,
}))

const { GET } = await import("./route")

beforeEach(() => {
  executeForAuthenticatedSupabaseId.mockReset()
  requireActiveAccountAccess.mockReset()
  requireActiveAccountAccess.mockResolvedValue(null)
  executeForAuthenticatedSupabaseId.mockResolvedValue(
    new Output(true, ["Projeção de cobrança calculada"], [], { billingOwnerId: "owner-1" })
  )
})

describe("GET /api/v1/billing/quote", () => {
  it("deriva a conta do master autenticado e ignora qualquer id no endereço", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/billing/quote?billingOwnerId=other-owner", {
        headers: { "x-supabase-user-id": "master-supabase-id" },
      })
    )

    expect(response.status).toBe(200)
    expect(executeForAuthenticatedSupabaseId).toHaveBeenCalledWith("master-supabase-id")
  })

  it("recusa membro sem executar uma projeção", async () => {
    executeForAuthenticatedSupabaseId.mockResolvedValue(
      new Output(false, [], ["Apenas o master pode visualizar a projeção de cobrança"], null)
    )

    const response = await GET(
      new NextRequest("http://localhost/api/v1/billing/quote", {
        headers: { "x-supabase-user-id": "member-supabase-id" },
      })
    )

    expect(response.status).toBe(403)
  })

  it("recusa master banido", async () => {
    executeForAuthenticatedSupabaseId.mockResolvedValue(
      new Output(false, [], ["Esta conta está bloqueada"], null)
    )

    const response = await GET(
      new NextRequest("http://localhost/api/v1/billing/quote", {
        headers: { "x-supabase-user-id": "banned-master-supabase-id" },
      })
    )

    expect(response.status).toBe(403)
  })

  it("não expõe a projeção quando o acesso da conta está pausado", async () => {
    requireActiveAccountAccess.mockResolvedValue(
      NextResponse.json(new Output(false, [], ["O acesso desta conta está pausado."], null), {
        status: 403,
      })
    )

    const response = await GET(
      new NextRequest("http://localhost/api/v1/billing/quote", {
        headers: { "x-supabase-user-id": "past-due-master" },
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(
      expect.objectContaining({ result: null, errorMessages: ["O acesso desta conta está pausado."] })
    )
    expect(executeForAuthenticatedSupabaseId).not.toHaveBeenCalled()
  })
})
