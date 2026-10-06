import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { ILandingPageRepository } from "@/app/api/infra/data/repositories/landingPages/ILandingPageRepository"

const deleteArchivedMock = mock(async (_teamId: string, _id: string): Promise<"deleted" | "not_archived" | "not_found"> => "deleted")
const repository: ILandingPageRepository = {
  listByTeam: mock(async () => []), findById: mock(async () => null), findByName: mock(async () => null),
  findPublicFormForTeam: mock(async () => null), findPublic: mock(async () => null), create: mock(async () => { throw new Error("not implemented") }),
  update: mock(async () => null), publish: mock(async () => null), archive: mock(async () => null), deleteArchived: deleteArchivedMock,
}
mock.module("@/app/api/infra/data/repositories/landingPages/LandingPageRepository", () => ({ landingPageRepository: repository }))
mock.module("@/app/api/services/featureAccess/FeatureAccessService", () => ({
  featureAccessService: { resolveAllowedSlugs: mock(async () => ({ slugs: ["email-landing-pages"] })), hasTeamFeatureAccess: mock(async () => true) },
}))
mock.module("@/app/api/infra/data/repositories/teamStudioDomain/TeamStudioDomainRepository", () => ({ teamStudioDomainRepository: { findByTeamId: mock(async () => null) } }))

const { LandingPageUseCase } = await import("./LandingPageUseCase")
const access: TeamAccess = {
  supabaseId: "supabase-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "manager@example.com",
  profileName: "Manager",
  isMaster: true,
  managerId: "manager-1",
  teamMember: { role: "manager", functions: [] },
  canManageAccountTeams: true,
  canCreateAccountUsers: true,
  canTransferAccountLeads: true,
  canViewAllTeams: true,
  userTimezone: "America/Sao_Paulo",
}

describe("LandingPageUseCase.deleteArchived", () => {
  beforeEach(() => deleteArchivedMock.mockClear())

  test("exclui a landing arquivada dentro do time autorizado", async () => {
    deleteArchivedMock.mockResolvedValueOnce("deleted")
    const output = await new LandingPageUseCase(repository).deleteArchived(access, "landing-1")
    expect(output.isValid).toBe(true)
    expect(deleteArchivedMock).toHaveBeenCalledWith("team-1", "landing-1")
  })

  test("recusa landing que não está arquivada", async () => {
    deleteArchivedMock.mockResolvedValueOnce("not_archived")
    const output = await new LandingPageUseCase(repository).deleteArchived(access, "landing-1")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Apenas landing pages arquivadas podem ser excluídas")
  })

  test("não revela landing ausente ou pertencente a outro time", async () => {
    deleteArchivedMock.mockResolvedValueOnce("not_found")
    const output = await new LandingPageUseCase(repository).deleteArchived(access, "landing-other-team")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Landing page não encontrada"])
  })
})
