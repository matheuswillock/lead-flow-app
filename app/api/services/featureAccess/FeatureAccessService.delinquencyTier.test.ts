import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { SubscriptionStatus } from "@prisma/client"
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

function makeFeature(overrides: Partial<ActiveFeatureRecord> = {}): ActiveFeatureRecord {
  return {
    id: overrides.slug ? `feature-${overrides.slug}` : "feature-crm",
    slug: "crm",
    name: "CRM",
    parentId: null,
    inheritParentSettings: false,
    betaEnabled: false,
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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

class FakeFeatureAccessRepository implements IFeatureAccessRepository {
  features: ActiveFeatureRecord[] = []
  userSubscriptions: ActiveUserSubscriptionRecord[] = []
  ownerSubscriptions: ActiveUserSubscriptionRecord[] = []
  betaEligibleFeatureIds = new Set<string>()
  currentUserRole = makeUserRole()
  ownerSubscriptionStatus: SubscriptionStatus | null = "past_due"
  ownerSubscriptionNextDueDate: Date | null = null
  ownerHasPermanentSubscription = false

  async listActiveFeatures() {
    return this.features
  }

  async findOwnerProfile() {
    return { hasPermanentSubscription: false, subscriptionStatus: this.ownerSubscriptionStatus }
  }

  async findOwnerProfileSubscription() {
    return {
      hasPermanentSubscription: this.ownerHasPermanentSubscription,
      subscriptionStatus: this.ownerSubscriptionStatus,
      subscriptionNextDueDate: this.ownerSubscriptionNextDueDate,
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

describe("FeatureAccessService.resolveAllowedSlugs — degrau de inadimplência (Fase 4 / T-20.28)", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    repository.features = [
      makeFeature({ id: "feature-crm", slug: "crm", productSlug: null }),
      makeFeature({ id: "feature-email", slug: "email", productSlug: "email" }),
      makeFeature({ id: "feature-whatsapp", slug: "whatsapp", productSlug: "whatsapp" }),
    ]
    service = new FeatureAccessService(repository)
  })

  it("past_due há 10 dias (dia 5-15) → só CRM aparece, email/whatsapp somem", async () => {
    repository.ownerSubscriptionNextDueDate = daysAgo(10)

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).not.toContain("email")
    expect(access.slugs).not.toContain("whatsapp")
  })

  it("past_due há 2 dias (dentro dos 5 dias de tolerância) → acesso total, nada é filtrado", async () => {
    repository.ownerSubscriptionNextDueDate = daysAgo(2)

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })

  it("past_due há 20 dias (corte total) → nenhuma feature (mesmo resultado do gate de assinatura inativa)", async () => {
    repository.ownerSubscriptionNextDueDate = daysAgo(20)

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })

  it("hasPermanentSubscription nunca degrada, mesmo past_due há 30 dias", async () => {
    repository.ownerHasPermanentSubscription = true
    repository.ownerSubscriptionNextDueDate = daysAgo(30)

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })

  it("status active nunca degrada, mesmo com due date antiga (dado inconsistente)", async () => {
    repository.ownerSubscriptionStatus = "active"
    repository.ownerSubscriptionNextDueDate = daysAgo(30)

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })
})
