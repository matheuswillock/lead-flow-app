import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))

const getRadarAccess = mock(async () => ({}))
const teamContextFromRadarAccess = mock(() => ({
  profileId: "operator-1",
  teamMember: { role: UserRole.manager, functions: [] },
}))
const promoteExecute = mock(async () => new Output(true, ["ok"], [], { leadId: "lead-1" }))

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess,
  teamContextFromRadarAccess,
}))

mock.module("@/app/api/useCases/radar/PromoteRadarProfileToLeadUseCase", () => ({
  promoteRadarProfileToLeadUseCase: {
    execute: promoteExecute,
  },
}))

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: mock(() => undefined),
}))

const { POST } = await import("./route")

const mockAccess = {
  error: null,
  status: 200,
  access: {
    supabaseId: "supabase-1",
    teamId: "team-1",
    profileId: "operator-1",
    profileEmail: "op@test.com",
    profileName: "Operator",
    isMaster: true,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role: UserRole.manager, functions: [] },
  },
}

function makeRequest(profileId = "profile-1"): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/v1/radar/profiles/${profileId}/promote-to-lead`, {
    method: "POST",
  })
  return [req, { params: Promise.resolve({ id: profileId }) }]
}

describe("POST /api/v1/radar/profiles/[id]/promote-to-lead", () => {
  beforeEach(() => {
    getRadarAccess.mockReset()
    teamContextFromRadarAccess.mockReset()
    promoteExecute.mockReset()

    getRadarAccess.mockResolvedValue(mockAccess)
    teamContextFromRadarAccess.mockReturnValue({
      profileId: "operator-1",
      teamMember: { role: UserRole.manager, functions: [] },
    })
    promoteExecute.mockResolvedValue(new Output(true, ["ok"], [], { leadId: "lead-1" }))
  })

  it("G2 — resolve TeamContext uma vez via getRadarAccess e repassa ao UseCase", async () => {
    const [req, params] = makeRequest("profile-abc")
    const res = await POST(req, params)

    expect(res.status).toBe(201)
    expect(getRadarAccess).toHaveBeenCalledTimes(1)
    expect(teamContextFromRadarAccess).toHaveBeenCalledTimes(1)
    expect(promoteExecute).toHaveBeenCalledWith({
      profileId: "profile-abc",
      access: mockAccess.access,
      ctx: { profileId: "operator-1", teamMember: { role: UserRole.manager, functions: [] } },
    })
  })

  it("G2 — perfil de outro time retorna erro apropriado", async () => {
    promoteExecute.mockResolvedValueOnce(
      new Output(false, [], ["Perfil Radar não encontrado neste time"], null)
    )

    const [req, params] = makeRequest("foreign-profile")
    const res = await POST(req, params)
    const body = (await res.json()) as { isValid: boolean; errorMessages: string[] }

    expect(res.status).toBe(404)
    expect(body.isValid).toBe(false)
    expect(body.errorMessages[0]).toContain("não encontrado")
  })
})
