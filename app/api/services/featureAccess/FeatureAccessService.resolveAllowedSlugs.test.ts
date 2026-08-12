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
const EMAIL_FEATURE_ID = "feature-email"
const EMAIL_CAMPAIGNS_FEATURE_ID = "feature-email-campaigns"

function makeFeature(
  overrides: Partial<ActiveFeatureRecord> = {}
): ActiveFeatureRecord {
  return {
    id: EMAIL_FEATURE_ID,
    slug: "email",
    name: "Email",
    parentId: null,
    inheritParentSettings: false,
    betaEnabled: true,
    chargeDuringBeta: false,
    accessMode: "PUBLIC",
    defaultAccessLevel: "FULL",
    billedSeparately: false,
    productSlug: null,
    accessRules: [],
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

describe("FeatureAccessService.resolveAllowedSlugs beta gate", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    service = new FeatureAccessService(repository)
  })

  it("bloqueia feature PUBLIC em beta quando o time não está elegível no Grupo Beta", async () => {
    repository.features = [makeFeature()]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).not.toContain("email")
    expect(access.betaSlugs).not.toContain("email")
    expect(access.betaLabelSlugs).not.toContain("email")
  })

  it("bloqueia feature ADDON em beta mesmo quando existe produto pago mas o time não está elegível", async () => {
    repository.features = [
      makeFeature({
        accessMode: "ADDON",
        productSlug: "email",
      }),
    ]
    repository.ownerSubscriptions = [{ product: { featureSlugs: ["email"] } }]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).not.toContain("email")
    expect(access.betaSlugs).not.toContain("email")
    expect(access.betaLabelSlugs).not.toContain("email")
  })

  it("libera feature ADDON em beta quando há produto pago e o time está elegível", async () => {
    repository.features = [
      makeFeature({
        id: EMAIL_CAMPAIGNS_FEATURE_ID,
        slug: "email-campaigns",
        accessMode: "ADDON",
        productSlug: "email",
      }),
    ]
    repository.ownerSubscriptions = [{ product: { featureSlugs: ["email"] } }]
    repository.betaEligibleFeatureIds = new Set([EMAIL_CAMPAIGNS_FEATURE_ID])

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("email-campaigns")
    expect(access.betaSlugs).toContain("email-campaigns")
    expect(access.betaLabelSlugs).toContain("email-campaigns")
  })
})
