import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  ActiveFeatureRecord,
  ActiveUserSubscriptionRecord,
  BetaEligibilityContext,
  IFeatureAccessRepository,
  OwnerUserTypeAssignment,
  UserRoleInfo,
} from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"

mock.module("@/lib/account/isAccountMasterBanned", () => ({
  isAccountMasterBanned: mock(async () => false),
}))

const { FeatureAccessService } = await import("./FeatureAccessService")

const PROFILE_ID = "profile-1"
const MANAGER_ID = "profile-1"
const TEAM_ID = "team-1"
const EMAIL_CAMPAIGNS_FEATURE_ID = "feature-email-campaigns"

function makeFeature(
  overrides: Partial<ActiveFeatureRecord> & Record<string, unknown> = {}
): ActiveFeatureRecord {
  return {
    id: EMAIL_CAMPAIGNS_FEATURE_ID,
    slug: "email-campaigns",
    name: "Campanhas",
    parentId: null,
    inheritParentSettings: false,
    betaEnabled: true,
    accessMode: "ADDON",
    defaultAccessLevel: "FULL",
    billedSeparately: false,
    productSlug: "email",
    chargeDuringBeta: false,
    accessRules: [
      { principal: "MASTER", accessLevel: "FULL" },
      { principal: "MANAGER", accessLevel: "FULL" },
    ],
    ...overrides,
  } as ActiveFeatureRecord
}

function makeUserRole(overrides: Partial<UserRoleInfo> = {}): UserRoleInfo {
  return {
    isMaster: true,
    role: "manager",
    functions: [],
    canManageAccountTeams: true,
    canCreateAccountUsers: true,
    userTypeSlug: "common",
    memberProActive: false,
    memberProExpiresAt: null,
    activeTeamId: TEAM_ID,
    ...overrides,
  }
}

class FakeFeatureAccessRepository implements IFeatureAccessRepository {
  features: ActiveFeatureRecord[] = []
  userSubscriptions: ActiveUserSubscriptionRecord[] = []
  ownerSubscriptions: ActiveUserSubscriptionRecord[] = []
  betaEligibleFeatureIds = new Set<string>()
  currentUserRole = makeUserRole()

  async listActiveFeatures() {
    return this.features
  }

  async findOwnerProfile() {
    return { hasPermanentSubscription: false, subscriptionStatus: "active" as const }
  }

  async findOwnerProfileSubscription() {
    return {
      hasPermanentSubscription: false,
      subscriptionStatus: "active" as const,
      product: null,
    }
  }

  async listActiveUserSubscriptions(profileId: string) {
    if (profileId === MANAGER_ID) return this.ownerSubscriptions
    return this.userSubscriptions
  }

  async listActiveBetaGrantsForProfile() {
    return []
  }

  async resolveBetaEligibleFeatureIds(_ctx: BetaEligibilityContext) {
    return this.betaEligibleFeatureIds
  }

  async findCurrentUserRoleInfo() {
    return this.currentUserRole
  }

  async findUserTypeAssignment(): Promise<OwnerUserTypeAssignment | null> {
    return null
  }
}

describe("FeatureAccessService chargeDuringBeta", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    service = new FeatureAccessService(repository)
    repository.betaEligibleFeatureIds = new Set([EMAIL_CAMPAIGNS_FEATURE_ID])
  })

  it("T01: beta gratuito com grant libera acesso sem produto pago", async () => {
    repository.features = [makeFeature({ chargeDuringBeta: false })]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("email-campaigns")
    expect(access.betaSlugs).toContain("email-campaigns")
    expect(access.betaLabelSlugs).toContain("email-campaigns")
  })

  it("T02: beta cobrado sem produto pago não libera uso gratuito", async () => {
    repository.features = [makeFeature({ chargeDuringBeta: true })]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).not.toContain("email-campaigns")
    expect(access.betaSlugs).toContain("email-campaigns")
    expect(access.betaLabelSlugs).not.toContain("email-campaigns")
  })

  it("T03: beta cobrado com produto/assinatura ativa libera acesso", async () => {
    repository.features = [makeFeature({ chargeDuringBeta: true })]
    repository.ownerSubscriptions = [{ product: { featureSlugs: ["email"] } }]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("email-campaigns")
    expect(access.betaSlugs).toContain("email-campaigns")
    expect(access.betaLabelSlugs).toContain("email-campaigns")
  })

  it("T05: resolveEmailBetaAccess retorna isenção para beta gratuito", async () => {
    repository.features = [makeFeature({ chargeDuringBeta: false })]

    const isExempt = await service.resolveEmailBetaAccess({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      isMaster: true,
      teamId: TEAM_ID,
    })

    expect(isExempt).toBe(true)
  })

  it("T06: resolveEmailBetaAccess não retorna isenção para beta cobrado", async () => {
    repository.features = [makeFeature({ chargeDuringBeta: true })]
    repository.ownerSubscriptions = [{ product: { featureSlugs: ["email"] } }]

    const isExempt = await service.resolveEmailBetaAccess({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      isMaster: true,
      teamId: TEAM_ID,
    })

    expect(isExempt).toBe(false)
  })
})
