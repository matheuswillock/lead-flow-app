import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { UserFunction, UserRole } from "@prisma/client"
import { NextRequest } from "next/server"
import * as teamAccessModule from "@/app/api/v1/utils/teamAccess"
import { featureAccessUseCase } from "@/app/api/useCases/featureAccess/FeatureAccessUseCase"
import { Output } from "@/lib/output"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { getRadarAccess } from "./getRadarAccess"

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/radar/profiles", { headers })
}

function makeTeamAccess(role: UserRole, isMaster = false): teamAccessModule.TeamAccessResult {
  return {
    access: {
      supabaseId: "user-1",
      teamId: "team-1",
      profileId: "profile-1",
      profileEmail: "user@test.com",
      profileName: "User",
      isMaster,
      managerId: "profile-1",
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
      canViewAllTeams: false,
      userTimezone: "America/Sao_Paulo",
      teamMember: { role, functions: [] as UserFunction[] },
    },
  }
}

describe("getRadarAccess", () => {
  let getTeamAccessSpy: ReturnType<typeof spyOn>
  let featureSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    getTeamAccessSpy = spyOn(teamAccessModule, "getTeamAccess")
    featureSpy = spyOn(featureAccessUseCase, "execute")
  })

  afterEach(() => {
    getTeamAccessSpy.mockRestore()
    featureSpy.mockRestore()
  })

  it("returns 401 when x-supabase-user-id is missing", async () => {
    getTeamAccessSpy.mockResolvedValue({
      error: new Output(false, [], ["ID do usuário é obrigatório"], null),
      status: 401,
    })

    const result = await getRadarAccess(makeRequest())

    expect(result.status).toBe(401)
    expect(result.error?.errorMessages).toContain("ID do usuário é obrigatório")
  })

  it("returns 403 for operator role", async () => {
    getTeamAccessSpy.mockResolvedValue(makeTeamAccess(UserRole.operator))

    const result = await getRadarAccess(
      makeRequest({ "x-supabase-user-id": "user-1", "x-team-id": "team-1" })
    )

    expect(result.status).toBe(403)
    expect(result.error?.errorMessages).toContain("Acesso negado ao Radar")
  })

  it("returns 403 for closer with SDR function only", async () => {
    getTeamAccessSpy.mockResolvedValue({
      access: {
        ...makeTeamAccess(UserRole.operator).access!,
        teamMember: { role: UserRole.operator, functions: [UserFunction.CLOSER] },
      },
    })

    const result = await getRadarAccess(
      makeRequest({ "x-supabase-user-id": "user-1", "x-team-id": "team-1" })
    )

    expect(result.status).toBe(403)
    expect(result.error?.errorMessages).toContain("Acesso negado ao Radar")
  })

  it("returns access for manager with Radar feature slug", async () => {
    getTeamAccessSpy.mockResolvedValue(makeTeamAccess(UserRole.manager))
    featureSpy.mockResolvedValue(new Output(true, [], [], { slugs: [FEATURE_SLUGS.CDP] }))

    const result = await getRadarAccess(
      makeRequest({ "x-supabase-user-id": "user-1", "x-team-id": "team-1" })
    )

    expect(result.access?.teamId).toBe("team-1")
    expect(result.error).toBeUndefined()
  })

  it("returns 403 for manager without Radar feature slug", async () => {
    getTeamAccessSpy.mockResolvedValue(makeTeamAccess(UserRole.manager))
    featureSpy.mockResolvedValue(new Output(true, [], [], { slugs: [] }))

    const result = await getRadarAccess(
      makeRequest({ "x-supabase-user-id": "user-1", "x-team-id": "team-1" })
    )

    expect(result.status).toBe(403)
    expect(result.error?.errorMessages).toContain("Add-on Radar não está ativo para este time")
  })
})
