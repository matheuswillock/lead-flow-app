import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const profileFindUnique = mock()
const teamMemberFindFirst = mock()
const teamFindFirst = mock()

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    teamMember: { findFirst: teamMemberFindFirst },
    team: { findFirst: teamFindFirst },
  },
}))

const execute = mock()
mock.module("@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase", () => ({
  accountAccessDecisionUseCase: { execute },
}))

const { getTeamAccess } = await import("./teamAccess")

const teamId = "11111111-1111-4111-8111-111111111111"
const sponsorTeamId = "22222222-2222-4222-8222-222222222222"
const profile = {
  id: "profile-1",
  email: "member@example.com",
  fullName: "Member",
  activeTeamId: teamId,
  isMaster: false,
  managerId: "owner-1",
  timezone: "America/Sao_Paulo",
  deletedAt: null,
}
const membership = {
  role: "operator",
  functions: [],
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  team: { masterId: "owner-1", deletedAt: null, master: { sponsorMasterId: null } },
}

beforeEach(() => {
  profileFindUnique.mockReset()
  teamMemberFindFirst.mockReset()
  teamFindFirst.mockReset()
  execute.mockReset()
  profileFindUnique.mockResolvedValue(profile)
  teamMemberFindFirst.mockResolvedValue(membership)
  execute.mockResolvedValue(new Output(true, [], [], { state: "allowed" }))
})

describe("getTeamAccess com gate de cobrança", () => {
  it("nega past_due antes de retornar TeamAccess", async () => {
    execute.mockResolvedValue(new Output(true, [], [], { state: "restricted", reason: "past_due", isBillingOwner: false }))

    const result = await getTeamAccess(
      new NextRequest(`http://localhost/api/v1/leads?teamId=${teamId}`, {
        headers: { "x-supabase-user-id": "supabase-member" },
      })
    )

    expect(result.status).toBe(403)
    expect(result.access).toBeUndefined()
    expect(result.error?.result).toBeNull()
    expect(result.error?.errorMessages[0]).toContain("Avise o administrador desta conta")
  })

  it("orienta o master a falar diretamente com assinaturas", async () => {
    execute.mockResolvedValue(new Output(true, [], [], { state: "restricted", reason: "past_due", isBillingOwner: true }))

    const result = await getTeamAccess(
      new NextRequest(`http://localhost/api/v1/leads?teamId=${teamId}`, {
        headers: { "x-supabase-user-id": "supabase-member" },
      })
    )

    expect(result.status).toBe(403)
    expect(result.error?.errorMessages[0]).toContain("time de assinaturas")
    expect(result.error?.errorMessages[0]).not.toContain("Avise o administrador")
  })

  it("prioriza a mensagem de banimento", async () => {
    execute.mockResolvedValue(new Output(true, [], [], { state: "restricted", reason: "banned" }))

    const result = await getTeamAccess(
      new NextRequest(`http://localhost/api/v1/leads?teamId=${teamId}`, {
        headers: { "x-supabase-user-id": "supabase-member" },
      })
    )

    expect(result.status).toBe(403)
    expect(result.error?.errorMessages[0]).toMatch(/suspenso/i)
  })

  it("usa o mesmo time para um sponsor sem membership", async () => {
    teamMemberFindFirst.mockResolvedValue(null)
    teamFindFirst.mockResolvedValue({
      masterId: "sponsored-owner",
      deletedAt: null,
      master: { sponsorMasterId: "profile-1" },
    })

    const result = await getTeamAccess(
      new NextRequest(`http://localhost/api/v1/leads?teamId=${sponsorTeamId}`, {
        headers: { "x-supabase-user-id": "supabase-member" },
      })
    )

    expect(result.access?.managerId).toBe("sponsored-owner")
    expect(execute).toHaveBeenCalledWith({ profileId: "profile-1", teamId: sponsorTeamId })
  })
})
