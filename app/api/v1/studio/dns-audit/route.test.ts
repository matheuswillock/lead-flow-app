import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamAccess, TeamAccessResult } from "@/app/api/v1/utils/teamAccess"

const access = { teamId: "team-1", isMaster: true, teamMember: { role: "manager" } } as TeamAccess
const getTeamAccessMock = mock(async (): Promise<TeamAccessResult> => ({ access }))
const getRecordsMock = mock(async () => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { studioDomain: { dnsAuditStatus: "verified" } },
}))

mock.module("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

mock.module("@/app/api/v1/utils/teamAccess", () => ({ getTeamAccess: getTeamAccessMock }))
mock.module("@/app/api/useCases/email/TeamStudioDomainUseCase", () => ({
  TeamStudioDomainUseCase: class { getRecords = getRecordsMock },
}))

const { GET } = await import("./route")

function makeRequest() {
  return { headers: { get: () => null } } as unknown as import("next/server").NextRequest
}

describe("GET /api/v1/studio/dns-audit", () => {
  beforeEach(() => {
    getTeamAccessMock.mockClear()
    getRecordsMock.mockClear()
    getTeamAccessMock.mockResolvedValue({ access })
  })

  it("rejeita usuário sem acesso sem consultar o lote", async () => {
    getTeamAccessMock.mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["ID do usuário é obrigatório"], result: null },
      status: 401,
    })

    const response = await GET(makeRequest()) as { status: number }

    expect(response.status).toBe(401)
    expect(getRecordsMock).not.toHaveBeenCalled()
  })

  it("consulta somente os dados persistidos do próprio time", async () => {
    const response = await GET(makeRequest()) as unknown as { status: number; body: { result: { studioDomain: { dnsAuditStatus: string } } } }

    expect(response.status).toBe(200)
    expect(response.body.result.studioDomain.dnsAuditStatus).toBe("verified")
    expect(getRecordsMock).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1" }), null)
  })
})
