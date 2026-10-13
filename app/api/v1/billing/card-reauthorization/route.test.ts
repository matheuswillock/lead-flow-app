import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import type { AuthenticatedSupabaseIdResult } from "@/app/api/v1/utils/getAuthenticatedSupabaseId"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))

const execute = mock(async () => new Output(true, [], [], { token: "secure-token" }))
mock.module("@/app/api/useCases/asaasAccountMigration/authenticatedCardReauthorizationFactory", () => ({
  createAuthenticatedCardReauthorizationLinkUseCase: { execute },
}))

const getAuthenticatedSupabaseId = mock(async (): Promise<AuthenticatedSupabaseIdResult> => ({ supabaseId: "master-1" }))
mock.module("@/app/api/v1/utils/getAuthenticatedSupabaseId", () => ({
  getAuthenticatedSupabaseId,
}))

const { POST } = await import("./route")

function request(supabaseId?: string) {
  return new NextRequest("http://localhost/api/v1/billing/card-reauthorization", {
    method: "POST",
    headers: supabaseId ? { "x-supabase-user-id": supabaseId } : undefined,
  })
}

beforeEach(() => {
  execute.mockReset()
  execute.mockResolvedValue(new Output(true, [], [], { token: "secure-token" }))
  getAuthenticatedSupabaseId.mockReset()
  getAuthenticatedSupabaseId.mockResolvedValue({ supabaseId: "master-1" })
})

describe("authenticated card reauthorization route", () => {
  it("emite link apenas para a sessão autenticada", async () => {
    const response = await POST(request("master-1"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ result: { token: "secure-token" } }))
    expect(execute).toHaveBeenCalledWith({ supabaseId: "master-1" })
  })

  it("não emite link sem sessão autenticada", async () => {
    getAuthenticatedSupabaseId.mockResolvedValueOnce({ error: new Output(false, [], ["Não autenticado"], null), status: 401 })
    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it("não diferencia conta membro, banida ou sem migração pronta", async () => {
    execute.mockResolvedValue(new Output(false, [], ["Regularização ainda não está disponível para esta conta"], null))

    const response = await POST(request("not-authorized"))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({ isValid: false }))
  })
})

