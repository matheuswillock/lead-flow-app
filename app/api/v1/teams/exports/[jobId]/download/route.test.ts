import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

mock.module("server-only", () => ({}))

const getAuthenticatedSupabaseId = mock(
  async (): Promise<{ supabaseId: string } | { error: Output; status: number }> => ({ supabaseId: "auth-1" }),
)
const createDownloadUrlForUser = mock(
  async (_input: { jobId: string; supabaseId: string }): Promise<Output> =>
    new Output(true, [], [], { url: "https://storage.test/signed?token=abc", fileName: "exportacao.zip" }),
)

mock.module("@/app/api/v1/utils/getAuthenticatedSupabaseId", () => ({ getAuthenticatedSupabaseId }))
mock.module("@/app/api/useCases/teamDeletion/teamDeletionComposition", () => ({
  teamDeletionUseCase: { createDownloadUrlForUser },
}))

const { GET } = await import("./route")

const request = () => new NextRequest("https://app.test/api/v1/teams/exports/job-1/download")
const params = (jobId = "job-1") => ({ params: Promise.resolve({ jobId }) })

describe("GET /teams/exports/[jobId]/download", () => {
  beforeEach(() => {
    getAuthenticatedSupabaseId.mockClear()
    createDownloadUrlForUser.mockClear()
  })

  it("logado e dono do pedido: redireciona para o link assinado", async () => {
    const response = await GET(request(), params())

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.test/signed?token=abc")
    expect(createDownloadUrlForUser).toHaveBeenCalledWith({ jobId: "job-1", supabaseId: "auth-1" })
  })

  it("sem login: manda para o login e não consulta o pedido", async () => {
    getAuthenticatedSupabaseId.mockResolvedValueOnce({ error: new Output(false, [], ["Não autenticado"], null), status: 401 })

    const response = await GET(request(), params())

    expect(response.headers.get("location")).toBe("https://app.test/sign-in")
    expect(createDownloadUrlForUser).not.toHaveBeenCalled()
  })

  it.each([
    ["not_found", 404],
    ["not_ready", 409],
    ["expired", 410],
  ])("recusa com código %s responde %i", async (code, status) => {
    createDownloadUrlForUser.mockResolvedValueOnce(new Output(false, [], ["recusado"], { code }))

    const response = await GET(request(), params())

    expect(response.status).toBe(status)
    expect(response.headers.get("location")).toBeNull()
  })
})
