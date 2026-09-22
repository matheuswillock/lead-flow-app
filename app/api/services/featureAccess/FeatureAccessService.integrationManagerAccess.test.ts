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
const TEAM_ID = "team-1"
const INTEGRATION_FEATURE_ID = "feature-integration"

/**
 * SPEC 15 (Hub de Integrações), achado de revisão R15-1/R15-2.
 *
 * A página de Integrações passou a depender só de `hasAccess("integration")`
 * no lugar da lista fixa de times (`lib/integrationsAccess.ts`, removida).
 * A lista antiga não olhava o papel do usuário — qualquer membro do time via
 * a página. A feature `integration`, porém, é resolvida por papel
 * (`principalsForUser` + `accessRules` desta suíte). Sem a regra MANAGER,
 * um manager não-master de um dos 3 times legados perderia o acesso que
 * tinha antes — foi exatamente isso que a revisão mediu em produção.
 *
 * Este teste exercita a MESMA camada de resolução usada em produção
 * (`FeatureAccessService.resolveAllowedSlugs`), não uma cópia da regra.
 */
/**
 * `betaEnabled: true` porque é assim que a feature está em produção
 * (confirmado via SELECT em `backoffice_features`). O gate de beta
 * (`FeatureAccessService.ts`: `if (betaEnabled && !betaEligible) continue`)
 * é o primeiro filtro antes de olhar `accessRules` — um teste com
 * `betaEnabled: false` não passaria por esse filtro e não provaria nada
 * sobre produção (achado de revisão, 2ª rodada).
 */
function makeIntegrationFeature(
  accessRules: ActiveFeatureRecord["accessRules"]
): ActiveFeatureRecord {
  return {
    id: INTEGRATION_FEATURE_ID,
    slug: "integration",
    name: "Integração",
    parentId: null,
    inheritParentSettings: false,
    betaEnabled: true,
    chargeDuringBeta: false,
    accessMode: "PUBLIC",
    defaultAccessLevel: "NONE",
    billedSeparately: false,
    productSlug: null,
    accessRules,
  } as ActiveFeatureRecord
}

function makeUserRole(overrides: Partial<UserRoleInfo> = {}): UserRoleInfo {
  return {
    isMaster: false,
    role: "manager",
    functions: [],
    canManageAccountTeams: false,
    canCreateAccountUsers: false,
    userTypeSlug: "common",
    memberProActive: false,
    memberProExpiresAt: null,
    activeTeamId: TEAM_ID,
    ...overrides,
  }
}

class FakeFeatureAccessRepository implements IFeatureAccessRepository {
  features: ActiveFeatureRecord[] = []
  currentUserRole = makeUserRole()
  /** Simula o `BackofficeFeatureGrant` BETA do time — vazio = time sem o grant. */
  betaEligibleFeatureIds = new Set<string>()

  async listActiveFeatures() {
    return this.features
  }

  async findOwnerProfile() {
    return { hasPermanentSubscription: false, subscriptionStatus: "active" as const }
  }

  async findOwnerProfileSubscription() {
    return { hasPermanentSubscription: false, subscriptionStatus: "active" as const, product: null }
  }

  async listActiveUserSubscriptions(): Promise<ActiveUserSubscriptionRecord[]> {
    return []
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

describe("FeatureAccessService.resolveAllowedSlugs — feature integration por papel (SPEC 15)", () => {
  let repository: FakeFeatureAccessRepository
  let service: InstanceType<typeof FeatureAccessService>

  // Regra de produção pós-correção (migration
  // 20260922010016_seed-integration-feature-manager-access.sql +
  // prisma/seed-backoffice-products.ts): MASTER e MANAGER = FULL, resto NONE.
  const CORRECTED_ACCESS_RULES: ActiveFeatureRecord["accessRules"] = [
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "NONE" },
    { principal: "OPERATOR", accessLevel: "NONE" },
    { principal: "SDR", accessLevel: "NONE" },
    { principal: "CLOSER", accessLevel: "NONE" },
  ]

  beforeEach(() => {
    repository = new FakeFeatureAccessRepository()
    service = new FeatureAccessService(repository)
  })

  it("libera a feature integration para o profile master do time, com o grant BETA do time (cenário real dos 3 times legados)", async () => {
    repository.features = [makeIntegrationFeature(CORRECTED_ACCESS_RULES)]
    repository.betaEligibleFeatureIds = new Set([INTEGRATION_FEATURE_ID])
    repository.currentUserRole = makeUserRole({ isMaster: true, role: "manager" })

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: PROFILE_ID,
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("integration")
  })

  it("libera a feature integration para um manager que NÃO é o master do time, com o grant BETA do time (achado R15-1)", async () => {
    repository.features = [makeIntegrationFeature(CORRECTED_ACCESS_RULES)]
    repository.betaEligibleFeatureIds = new Set([INTEGRATION_FEATURE_ID])
    repository.currentUserRole = makeUserRole({ isMaster: false, role: "manager" })

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: "outro-profile-master",
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).toContain("integration")
  })

  it("NÃO libera a feature integration para um manager não-master SEM o grant BETA do time (a regra MANAGER sozinha não basta)", async () => {
    repository.features = [makeIntegrationFeature(CORRECTED_ACCESS_RULES)]
    repository.betaEligibleFeatureIds = new Set() // time sem o BackofficeFeatureGrant BETA
    repository.currentUserRole = makeUserRole({ isMaster: false, role: "manager" })

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: "outro-profile-master",
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).not.toContain("integration")
  })

  it("NÃO libera a feature integration para SDR/CLOSER/OPERATOR não-master, mesmo com o grant BETA do time (coerente com requireManager do backend)", async () => {
    repository.features = [makeIntegrationFeature(CORRECTED_ACCESS_RULES)]
    repository.betaEligibleFeatureIds = new Set([INTEGRATION_FEATURE_ID])

    for (const role of ["operator"] as const) {
      repository.currentUserRole = makeUserRole({ isMaster: false, role, functions: ["SDR", "CLOSER"] })

      const access = await service.resolveAllowedSlugs({
        profileId: PROFILE_ID,
        managerId: "outro-profile-master",
        activeTeamId: TEAM_ID,
      })

      expect(access.slugs).not.toContain("integration")
    }
  })

  // Controle negativo: sem a regra MANAGER (comportamento pré-correção desta
  // migration), o mesmo manager não-master do time COM o grant BETA perde o
  // acesso — prova que o teste acima falharia sem a correção da migration.
  it("controle negativo: sem a regra MANAGER, o manager não-master perde acesso mesmo com o grant BETA do time", async () => {
    const legacyAccessRulesWithoutManager: ActiveFeatureRecord["accessRules"] = [
      { principal: "MASTER", accessLevel: "FULL" },
      { principal: "MANAGER", accessLevel: "NONE" },
      { principal: "BACKOFFICE", accessLevel: "NONE" },
      { principal: "OPERATOR", accessLevel: "NONE" },
      { principal: "SDR", accessLevel: "NONE" },
      { principal: "CLOSER", accessLevel: "NONE" },
    ]
    repository.features = [makeIntegrationFeature(legacyAccessRulesWithoutManager)]
    repository.betaEligibleFeatureIds = new Set([INTEGRATION_FEATURE_ID])
    repository.currentUserRole = makeUserRole({ isMaster: false, role: "manager" })

    const access = await service.resolveAllowedSlugs({
      profileId: PROFILE_ID,
      managerId: "outro-profile-master",
      activeTeamId: TEAM_ID,
    })

    expect(access.slugs).not.toContain("integration")
  })
})
