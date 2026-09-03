import { beforeEach, describe, expect, it, mock } from "bun:test"
import { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  radarRepositoryMock,
  registerRadarRepositoryModuleMock,
} from "@/test/support/radar-repository-module-mock"

const updateProfileGenderWithCtx = mock(async () => ({ updated: true }))

await registerRadarRepositoryModuleMock()
Object.assign(radarRepositoryMock, {
  updateProfileGenderWithCtx,
})

const { updateRadarProfileUseCase } = await import("./UpdateRadarProfileUseCase")

function makeAccess(teamId = "team-1"): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId,
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
  }
}

const baseInput = {
  profileId: "profile-1",
  access: makeAccess(),
  ctx: {
    profileId: "operator-1",
    teamMember: { role: UserRole.manager, functions: [] },
  },
  gender: "female" as const,
}

describe("UpdateRadarProfileUseCase (F3)", () => {
  beforeEach(() => {
    updateProfileGenderWithCtx.mockReset()
    updateProfileGenderWithCtx.mockImplementation(async () => ({ updated: true }))
  })

  it("F3 — atualiza gender com genderSource manual", async () => {
    const output = await updateRadarProfileUseCase.execute(baseInput)

    expect(output.isValid).toBe(true)
    expect(updateProfileGenderWithCtx).toHaveBeenCalledTimes(1)
    expect(updateProfileGenderWithCtx).toHaveBeenCalledWith(
      { teamId: "team-1", ctx: baseInput.ctx },
      "profile-1",
      "female"
    )
    expect(output.result).toEqual(
      expect.objectContaining({ gender: "female", genderSource: "manual" })
    )
  })

  it("F3 — perfil de outro time não é editável", async () => {
    updateProfileGenderWithCtx.mockImplementation(async () => ({ updated: false }))

    const output = await updateRadarProfileUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/não encontrado|perfil/i)
  })
})
