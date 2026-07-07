import { describe, expect, it } from "bun:test"
import { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { canCreateEmailTemplate, canDispatchEmail } from "./email-rbac"

function makeCtx(role: UserRole): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId: "team-1",
    profileId: "profile-1",
    profileEmail: "user@test.com",
    profileName: "User",
    isMaster: role === UserRole.manager,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role, functions: [] },
  }
}

describe("email-rbac", () => {
  it("permite dispatch para manager e backoffice por padrão", () => {
    expect(canDispatchEmail(makeCtx(UserRole.manager))).toBe(true)
    expect(canDispatchEmail(makeCtx(UserRole.backoffice))).toBe(true)
    expect(canDispatchEmail(makeCtx(UserRole.operator))).toBe(false)
  })

  it("respeita dispatchAllowedRoles customizado", () => {
    const operator = makeCtx(UserRole.operator)
    expect(
      canDispatchEmail(operator, { dispatchAllowedRoles: ["operator", "manager"] })
    ).toBe(true)
    expect(canDispatchEmail(operator, { dispatchAllowedRoles: ["manager"] })).toBe(false)
  })

  it("respeita templateCreateRoles customizado", () => {
    const operator = makeCtx(UserRole.operator)
    expect(canCreateEmailTemplate(operator)).toBe(false)
    expect(
      canCreateEmailTemplate(operator, { templateCreateRoles: ["operator"] })
    ).toBe(true)
  })
})
