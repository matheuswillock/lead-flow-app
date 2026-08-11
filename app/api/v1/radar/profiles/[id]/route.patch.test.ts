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
const updateExecute = mock(async () =>
  new Output(true, ["ok"], [], { id: "profile-1", gender: "female", genderSource: "manual" })
)

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess,
  teamContextFromRadarAccess,
}))

mock.module("@/app/api/useCases/radar/UpdateRadarProfileUseCase", () => ({
  updateRadarProfileUseCase: {
    execute: updateExecute,
  },
}))

const { PATCH } = await import("./route")

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

function makePatchRequest(
  profileId: string,
  body: unknown
): [InstanceType<typeof NextRequest>, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/v1/radar/profiles/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: profileId }) }]
}

describe("PATCH /api/v1/radar/profiles/[id]", () => {
  beforeEach(() => {
    getRadarAccess.mockReset()
    teamContextFromRadarAccess.mockReset()
    updateExecute.mockReset()

    getRadarAccess.mockResolvedValue(mockAccess)
    teamContextFromRadarAccess.mockReturnValue({
      profileId: "operator-1",
      teamMember: { role: UserRole.manager, functions: [] },
    })
    updateExecute.mockResolvedValue(
      new Output(true, ["ok"], [], { id: "profile-1", gender: "female", genderSource: "manual" })
    )
  })

  it("F3 — edição válida retorna 200 com genderSource manual", async () => {
    const [req, params] = makePatchRequest("profile-abc", { gender: "female" })
    const res = await PATCH(req, params)
    const body = (await res.json()) as {
      isValid: boolean
      result: { gender: string; genderSource: string }
    }

    expect(res.status).toBe(200)
    expect(body.isValid).toBe(true)
    expect(body.result.gender).toBe("female")
    expect(body.result.genderSource).toBe("manual")
    expect(getRadarAccess).toHaveBeenCalledTimes(1)
    expect(teamContextFromRadarAccess).toHaveBeenCalledTimes(1)
    expect(updateExecute).toHaveBeenCalledWith({
      profileId: "profile-abc",
      access: mockAccess.access,
      ctx: { profileId: "operator-1", teamMember: { role: UserRole.manager, functions: [] } },
      gender: "female",
    })
  })

  it("F3 — payload inválido retorna 400", async () => {
    const [req, params] = makePatchRequest("profile-abc", { gender: "invalido" })
    const res = await PATCH(req, params)
    const body = (await res.json()) as { isValid: boolean; errorMessages: string[] }

    expect(res.status).toBe(400)
    expect(body.isValid).toBe(false)
    expect(updateExecute).not.toHaveBeenCalled()
  })

  it("F3 — perfil de outro time retorna 404", async () => {
    updateExecute.mockResolvedValueOnce(
      new Output(false, [], ["Perfil Radar não encontrado neste time"], null)
    )

    const [req, params] = makePatchRequest("foreign-profile", { gender: "male" })
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
  })
})
