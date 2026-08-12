import { beforeEach, describe, expect, it, mock } from "bun:test"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

const resolveAllowedSlugsMock = mock(async () => ({
  slugs: [] as string[],
  betaSlugs: [] as string[],
  betaLabelSlugs: [] as string[],
  userRole: {
    isMaster: true,
    role: "MANAGER",
    functions: [],
    canManageAccountTeams: true,
    canCreateAccountUsers: true,
    userTypeSlug: "manager",
    memberProActive: false,
    memberProExpiresAt: null,
    activeTeamId: "team-1",
  },
}))

mock.module("@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository", () => ({
  FeatureAccessRepository: class {
    listActiveFeatures = mock(async () => [])
    resolveBetaEligibleFeatureIds = mock(async () => new Set())
  },
}))

const { FeatureAccessService } = await import("./FeatureAccessService")

describe("FeatureAccessService.resolveRadarBetaAccess", () => {
  let service: InstanceType<typeof FeatureAccessService>

  beforeEach(() => {
    service = new FeatureAccessService({} as never)
    // Override instance method used by resolveRadarBetaAccess
    ;(service as unknown as { resolveAllowedSlugs: typeof resolveAllowedSlugsMock }).resolveAllowedSlugs =
      resolveAllowedSlugsMock
    resolveAllowedSlugsMock.mockClear()
  })

  it("libera quando betaLabelSlugs contém RADAR no time ativo", async () => {
    resolveAllowedSlugsMock.mockImplementation(async () => ({
      slugs: [FEATURE_SLUGS.RADAR],
      betaSlugs: [FEATURE_SLUGS.RADAR],
      betaLabelSlugs: [FEATURE_SLUGS.RADAR],
      userRole: {
        isMaster: true,
        role: "MANAGER",
        functions: [],
        canManageAccountTeams: true,
        canCreateAccountUsers: true,
        userTypeSlug: "manager",
        memberProActive: false,
        memberProExpiresAt: null,
        activeTeamId: "team-1",
      },
    }))

    const allowed = await service.resolveRadarBetaAccess({
      profileId: "p1",
      managerId: "p1",
      isMaster: true,
      teamId: "team-1",
    })
    expect(allowed).toBe(true)
    expect(resolveAllowedSlugsMock).toHaveBeenCalledWith({
      profileId: "p1",
      managerId: "p1",
      activeTeamId: "team-1",
    })
  })

  it("bloqueia quando RADAR não está em betaLabelSlugs (outro time / fora do grant)", async () => {
    resolveAllowedSlugsMock.mockImplementation(async () => ({
      slugs: [],
      betaSlugs: [],
      betaLabelSlugs: [],
      userRole: {
        isMaster: true,
        role: "MANAGER",
        functions: [],
        canManageAccountTeams: true,
        canCreateAccountUsers: true,
        userTypeSlug: "manager",
        memberProActive: false,
        memberProExpiresAt: null,
        activeTeamId: "team-outro",
      },
    }))

    const allowed = await service.resolveRadarBetaAccess({
      profileId: "p1",
      managerId: "p1",
      isMaster: true,
      teamId: "team-outro",
    })
    expect(allowed).toBe(false)
  })
})
