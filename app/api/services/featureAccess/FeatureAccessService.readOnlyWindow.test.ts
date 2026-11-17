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
  async hasActiveExpiredMemberProCrmGrace() {
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

describe("FeatureAccessService.resolveAllowedSlugs — carência genérica (allowed com aviso / read_only)", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  const ALL_SLUGS = [
    "crm",
    "crm-wallet",
    "crm-dashboard",
    "crm-calendar",
    "crm-automations",
    "email",
    "whatsapp",
    "radar",
  ]

  const resolve = () =>
    service.resolveAllowedSlugs({ profileId: PROFILE_ID, managerId: PROFILE_ID, activeTeamId: TEAM_ID })
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    repository.features = ALL_SLUGS.map(makeFeature)
    service = new FeatureAccessService(repository)
  })

  it("dentro do prazo de carência (dias 1 a 5): acesso total a tudo que já tinha, modo full", async () => {
    repository.subscriptionDueDate = daysAgo(2)

    const access = await resolve()

    expect([...access.slugs].sort()).toEqual([...ALL_SLUGS].sort())
    expect(access.mode).toBe("full")
  })

  it("carência expirada (a partir do dia 6, sem corte superior): leitura em tudo que já tinha, modo read_only", async () => {
    repository.subscriptionDueDate = daysAgo(10)
    expect([...(await resolve()).slugs].sort()).toEqual([...ALL_SLUGS].sort())
    expect((await resolve()).mode).toBe("read_only")

    // Sem corte fixo: mesmo muito depois do vencimento, continua leitura (não bloqueio total) —
    // a transição para bloqueio depende do motor de assinatura marcar suspended/canceled.
    repository.subscriptionDueDate = daysAgo(60)
    expect([...(await resolve()).slugs].sort()).toEqual([...ALL_SLUGS].sort())
    expect((await resolve()).mode).toBe("read_only")
  })

  it("sem data de vencimento não há carência nem leitura — continua sem acesso", async () => {
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
    // A mais antiga (10 dias) já expirou a carência, mesmo com a outra data ainda recente (3 dias):
    // usar a data errada (a mais recente) mostraria "full" em vez de "read_only".
    repository.subscriptionDueDate = daysAgo(3)
    repository.profileDueDate = daysAgo(10)
    expect((await resolve()).mode).toBe("read_only")

    repository.subscriptionDueDate = daysAgo(10)
    repository.profileDueDate = daysAgo(3)
    expect((await resolve()).mode).toBe("read_only")
  })

  it("não inventa uma funcionalidade que não existe no catálogo", async () => {
    repository.features = ["crm", "email"].map(makeFeature)
    repository.subscriptionDueDate = daysAgo(10)

    expect([...(await resolve()).slugs].sort()).toEqual(["crm", "email"])
  })
})
