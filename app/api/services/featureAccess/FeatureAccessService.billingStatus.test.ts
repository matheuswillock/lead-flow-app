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


class FakeFeatureAccessRepository implements IFeatureAccessRepository {
  features: ActiveFeatureRecord[] = []
  userSubscriptions: ActiveUserSubscriptionRecord[] = []
  ownerSubscriptions: ActiveUserSubscriptionRecord[] = []
  temporaryBillingGrace = false
  betaEligibleFeatureIds = new Set<string>()
  currentUserRole = makeUserRole()
  ownerSubscriptionStatus: SubscriptionStatus | null = "past_due"
  ownerSubscriptionNextDueDate: Date | null = null
  ownerProfileNextDueDate: Date | null = null
  ownerHasPermanentSubscription = false
  ownerProductFeatureSlugs: string[] | null = null
  ownerUserTypeAssignment: { slug: string; accessStartsAt: string | null; accessExpiresAt: string | null } | null = null

  async listActiveFeatures() {
    return this.features
  }

  async findTeamMasterId() {
    return MANAGER_ID
  }

  async findOwnerProfile() {
    return {
      hasPermanentSubscription: false,
      subscriptionStatus: this.ownerSubscriptionStatus,
      subscriptionNextDueDate: this.ownerProfileNextDueDate,
    }
  }

  async findOwnerProfileSubscription() {
    return {
      hasPermanentSubscription: this.ownerHasPermanentSubscription,
      subscriptionStatus: this.ownerSubscriptionStatus,
      subscriptionNextDueDate: this.ownerSubscriptionNextDueDate,
      product: this.ownerProductFeatureSlugs ? { featureSlugs: this.ownerProductFeatureSlugs } : null,
    }
  }

  async listActiveUserSubscriptions(profileId: string) {
    if (profileId === MANAGER_ID) return this.ownerSubscriptions
    return this.userSubscriptions
  }

  async hasActiveTemporaryBillingGrace() {
    return this.temporaryBillingGrace
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
    return this.ownerUserTypeAssignment
  }
}

describe("FeatureAccessService.resolveAllowedSlugs — bloqueio imediato por status de cobrança", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    repository.features = [
      makeFeature({ id: "feature-crm", slug: "crm", productSlug: null }),
      makeFeature({ id: "feature-crm-automations", slug: "crm-automations", productSlug: null }),
      makeFeature({ id: "feature-email", slug: "email", productSlug: "email" }),
      makeFeature({ id: "feature-whatsapp", slug: "whatsapp", productSlug: "whatsapp" }),
    ]
    service = new FeatureAccessService(repository)
  })

  it("bloqueia past_due imediatamente, sem período de tolerância", async () => {

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })

  it("libera somente funcionalidades do produto contratado durante a concessão temporária", async () => {
    repository.temporaryBillingGrace = true
    repository.ownerProductFeatureSlugs = ["crm"]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).not.toContain("email")
    expect(access.slugs).not.toContain("whatsapp")
  })

  it("bloqueia funcionalidades quando a concessão expirou", async () => {
    repository.ownerSubscriptions = [{ product: { featureSlugs: ["crm"] } }]

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })

  it("bloqueia suspended imediatamente", async () => {
    repository.ownerSubscriptionStatus = "suspended"

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })

  it("bloqueia canceled imediatamente", async () => {
    repository.ownerSubscriptionStatus = "canceled"

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })

  it("mantém assinatura permanente liberada mesmo com status past_due", async () => {
    repository.ownerHasPermanentSubscription = true

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })

  it("mantém active liberada mesmo com vencimento antigo", async () => {
    repository.ownerSubscriptionStatus = "active"
    repository.ownerSubscriptionNextDueDate = new Date("2020-01-01")

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })

  it("não restringe acesso normal quando a concessão antiga ainda está marcada como ativa", async () => {
    repository.ownerSubscriptionStatus = "active"
    repository.temporaryBillingGrace = true

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
    expect(access.slugs).toContain("email")
    expect(access.slugs).toContain("whatsapp")
  })

  it("libera Member PRO vigente mesmo com assinatura suspensa", async () => {
    repository.ownerUserTypeAssignment = {
      slug: "member_pro",
      accessStartsAt: new Date(Date.now() - 1_000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1_000).toISOString(),
    }
    repository.ownerSubscriptionStatus = "suspended"

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("crm")
  })

  it("bloqueia Member PRO expirado", async () => {
    repository.ownerUserTypeAssignment = {
      slug: "member_pro",
      accessStartsAt: null,
      accessExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    }
    repository.ownerSubscriptionStatus = "suspended"

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: MANAGER_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toEqual([])
  })



})
