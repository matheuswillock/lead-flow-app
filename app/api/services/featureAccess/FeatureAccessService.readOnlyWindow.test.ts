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
const TEAM_ID = "team-1"
const DAY_MS = 24 * 60 * 60 * 1000

function makeFeature(slug: string): ActiveFeatureRecord {
  return {
    id: `feature-${slug}`,
    slug,
    name: slug,
    parentId: null,
    inheritParentSettings: false,
    betaEnabled: false,
    chargeDuringBeta: false,
    accessMode: "PUBLIC",
    defaultAccessLevel: "FULL",
    billedSeparately: false,
    productSlug: null,
    accessRules: [],
  } as ActiveFeatureRecord
}

const userRole: UserRoleInfo = {
  isMaster: true,
  role: "manager",
  functions: [],
  canManageAccountTeams: true,
  canCreateAccountUsers: true,
  userTypeSlug: "common",
  memberProActive: false,
  memberProExpiresAt: null,
  activeTeamId: TEAM_ID,
}

class FakeFeatureAccessRepository implements IFeatureAccessRepository {
  features: ActiveFeatureRecord[] = []
  status: SubscriptionStatus | null = "past_due"
  subscriptionDueDate: Date | null = null
  profileDueDate: Date | null = null

  async listActiveFeatures() {
    return this.features
  }
  async findTeamMasterId() {
    return PROFILE_ID
  }
  async findOwnerProfile() {
    return {
      hasPermanentSubscription: false,
      subscriptionStatus: this.status,
      subscriptionNextDueDate: this.profileDueDate,
    }
  }
  async findOwnerProfileSubscription() {
    return {
      hasPermanentSubscription: false,
      subscriptionStatus: this.status,
      subscriptionNextDueDate: this.subscriptionDueDate,
      product: null,
    }
  }
  async listActiveUserSubscriptions(): Promise<ActiveUserSubscriptionRecord[]> {
    return []
  }
  async hasActiveTemporaryBillingGrace() {
    return false
  }
  async listActiveBetaGrantsForProfile() {
    return []
  }
  async resolveBetaEligibleFeatureIds(_ctx: BetaEligibilityContext) {
    return new Set<string>()
  }
  async findCurrentUserRoleInfo() {
    return userRole
  }
  async findUserTypeAssignment(): Promise<OwnerUserTypeAssignment | null> {
    return null
  }
}

describe("FeatureAccessService.resolveAllowedSlugs — janela de somente leitura (dias 6 a 15)", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  const resolve = () =>
    service.resolveAllowedSlugs({ profileId: PROFILE_ID, managerId: PROFILE_ID, activeTeamId: TEAM_ID })
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    repository.features = [
      "crm",
      "crm-wallet",
      "crm-dashboard",
      "crm-calendar",
      "crm-automations",
      "email",
      "whatsapp",
      "radar",
    ].map(makeFeature)
    service = new FeatureAccessService(repository)
  })

  it("libera só o CRM e a Carteira, nada mais", async () => {
    repository.subscriptionDueDate = daysAgo(10)

    const access = await resolve()

    expect([...access.slugs].sort()).toEqual(["crm", "crm-wallet"])
    expect(access.betaSlugs).toEqual([])
    expect(access.betaLabelSlugs).toEqual([])
  })

  it("vale a partir do dia 6 e até o dia 15", async () => {
    repository.subscriptionDueDate = daysAgo(5.5)
    expect([...(await resolve()).slugs].sort()).toEqual(["crm", "crm-wallet"])

    repository.subscriptionDueDate = daysAgo(14.5)
    expect([...(await resolve()).slugs].sort()).toEqual(["crm", "crm-wallet"])
  })

  it("do dia 16 em diante não libera nada", async () => {
    repository.subscriptionDueDate = daysAgo(15.5)

    expect((await resolve()).slugs).toEqual([])
  })

  it("não altera a regra atual dentro da carência nem sem data de vencimento", async () => {
    repository.subscriptionDueDate = daysAgo(2)
    expect((await resolve()).slugs).toEqual([])

    repository.subscriptionDueDate = null
    repository.profileDueDate = null
    expect((await resolve()).slugs).toEqual([])
  })

  it("só vale para past_due: suspenso e cancelado seguem sem acesso", async () => {
    repository.subscriptionDueDate = daysAgo(10)

    for (const status of ["suspended", "canceled"] as const) {
      repository.status = status
      expect((await resolve()).slugs, status).toEqual([])
    }
  })

  it("conta o vencimento a partir da data mais antiga entre perfil e assinatura", async () => {
    // A mais antiga (20 dias) já passou do dia 15: nada liberado, mesmo com a outra data recente.
    repository.subscriptionDueDate = daysAgo(20)
    repository.profileDueDate = daysAgo(10)
    expect((await resolve()).slugs).toEqual([])

    repository.subscriptionDueDate = daysAgo(10)
    repository.profileDueDate = daysAgo(20)
    expect((await resolve()).slugs).toEqual([])

    // A mais antiga (10 dias) está na janela de somente leitura.
    repository.subscriptionDueDate = daysAgo(10)
    repository.profileDueDate = daysAgo(2)
    expect([...(await resolve()).slugs].sort()).toEqual(["crm", "crm-wallet"])
  })

  it("não inventa uma funcionalidade que não existe no catálogo", async () => {
    repository.features = ["crm", "email"].map(makeFeature)
    repository.subscriptionDueDate = daysAgo(10)

    expect((await resolve()).slugs).toEqual(["crm"])
  })
})
