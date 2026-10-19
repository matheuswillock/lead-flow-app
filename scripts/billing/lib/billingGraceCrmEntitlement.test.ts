import { describe, expect, it } from "bun:test"
import {
  assertApprovedCrmEntitlementPolicy,
  buildCrmEntitlementReport,
  classifyTeamCrmEntitlement,
  computeCrmEntitlementChecksum,
  createCrmEntitlementPolicy,
  CRM_ENTITLEMENT_REASONS,
  DEFAULT_CRM_PRODUCT_ID,
  DEFAULT_CRM_PRODUCT_NAME,
  REQUIRED_CRM_FEATURE_SLUG,
  resolveApplyDecision,
  type CrmProductSnapshot,
  type TeamCrmEntitlementSnapshot,
} from "./billingGraceCrmEntitlement"

const NOW = new Date("2026-10-19T12:00:00.000Z")
const OPERATOR_ID = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"
const POLICY = createCrmEntitlementPolicy(OPERATOR_ID)
const PRODUCT: CrmProductSnapshot = {
  id: DEFAULT_CRM_PRODUCT_ID,
  name: DEFAULT_CRM_PRODUCT_NAME,
  featureSlugs: [REQUIRED_CRM_FEATURE_SLUG],
  isActive: true,
  type: "PLAN",
}
const GRACE = {
  id: "33333333-3333-4333-8333-333333333333",
  expiresAt: new Date(POLICY.expiry),
  isActive: true,
  reason: "bulk_subscription_billing_grace",
  grantedByProfileId: OPERATOR_ID,
  createdAt: new Date("2026-10-19T08:24:00.000Z"),
}

function baseSnapshot(
  overrides: Partial<TeamCrmEntitlementSnapshot> = {}
): TeamCrmEntitlementSnapshot {
  return {
    teamId: "11111111-1111-4111-8111-111111111111",
    teamName: "Time Teste",
    masterId: "22222222-2222-4222-8222-222222222222",
    masterEmail: "master@example.com",
    masterName: "Master",
    masterDeleted: false,
    profileSubscriptionStatus: "past_due",
    hasPermanentAccess: false,
    profileProduct: null,
    activeBackofficeSubscriptions: [],
    existingCrmEntitlements: [],
    memberPro: null,
    masterBans: [],
    activeGraces: [GRACE],
    activeUsers: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        email: "user@example.com",
        fullName: "User",
      },
    ],
    activeUserBans: [],
    ...overrides,
  }
}

function includedEntry(
  overrides: Partial<TeamCrmEntitlementSnapshot> = {}
) {
  return classifyTeamCrmEntitlement(baseSnapshot(overrides), POLICY, NOW)
}

describe("classificação do grant CRM da grace", () => {
  it("inclui time com grace do lote e sem produto", () => {
    const entry = includedEntry()

    expect(entry.decision).toBe("included")
    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.included)
    expect(entry.action).toBe("create")
    expect(entry.graceId).toBe(GRACE.id)
    expect(entry.activeUsers).toBe(1)
    expect(entry.currentCrmAccess).toBe(false)
  })

  it("exclui Member PRO expirado, mesmo com produto", () => {
    const entry = includedEntry({
      memberPro: {
        slug: "member_pro",
        accessStartsAt: null,
        accessExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      profileProduct: {
        productId: "55555555-5555-4555-8555-555555555555",
        productName: "CRM",
        featureSlugs: ["crm"],
      },
    })

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.memberProExpired)
    expect(entry.action).toBeNull()
  })

  it("exclui time com produto já vinculado", () => {
    const entry = includedEntry({
      profileProduct: {
        productId: "55555555-5555-4555-8555-555555555555",
        productName: "CRM",
        featureSlugs: ["crm"],
      },
    })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.profileProduct)
  })

  it("exclui time com assinatura de produto ativa", () => {
    const entry = includedEntry({
      activeBackofficeSubscriptions: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          productId: "55555555-5555-4555-8555-555555555555",
          productName: "CRM",
          featureSlugs: ["crm"],
          status: "active",
          startDate: null,
          endDate: new Date(POLICY.expiry),
        },
      ],
    })

    expect(entry.reason).toBe(
      CRM_ENTITLEMENT_REASONS.activeBackofficeSubscription
    )
  })

  it("exclui registro CRM existente para revisão manual, sem overwrite", () => {
    const entry = includedEntry({
      existingCrmEntitlements: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          productId: DEFAULT_CRM_PRODUCT_ID,
          productName: "CRM",
          featureSlugs: ["crm"],
          status: "inactive",
          startDate: null,
          endDate: null,
        },
      ],
    })

    expect(entry.reason).toBe(
      CRM_ENTITLEMENT_REASONS.existingCrmEntitlement
    )
  })

  it("exclui acesso permanente", () => {
    const entry = includedEntry({ hasPermanentAccess: true })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.permanent)
  })

  it("exclui time sem grace ativa do lote", () => {
    const entry = includedEntry({ activeGraces: [] })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.noBatchGrace)
  })

  it("exclui grace de outro operador", () => {
    const entry = includedEntry({
      activeGraces: [
        {
          ...GRACE,
          grantedByProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      ],
    })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.noBatchGrace)
  })

  it("exclui múltiplas graces do lote", () => {
    const entry = includedEntry({
      activeGraces: [GRACE, { ...GRACE, id: "88888888-8888-4888-8888-888888888888" }],
    })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.multipleBatchGraces)
  })

  it("exclui master banido", () => {
    const entry = includedEntry({
      masterBans: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          profileId: "22222222-2222-4222-8222-222222222222",
          scope: "global",
          email: "master@example.com",
          reason: "teste",
        },
      ],
    })

    expect(entry.reason).toBe(CRM_ENTITLEMENT_REASONS.masterBanned)
  })
})

describe("relatório e checksum do grant CRM", () => {
  it("resume incluídos, excluídos e bans sem removê-los", () => {
    const included = includedEntry()
    const memberPro = includedEntry({
      teamId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      teamName: "Member PRO Expirado",
      memberPro: {
        slug: "member_pro",
        accessStartsAt: null,
        accessExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    })
    const profileProduct = includedEntry({
      teamId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      teamName: "Já Tem Produto",
      profileProduct: {
        productId: DEFAULT_CRM_PRODUCT_ID,
        productName: "CRM",
        featureSlugs: ["crm"],
      },
    })

    const report = buildCrmEntitlementReport(
      [included, memberPro, profileProduct],
      POLICY,
      PRODUCT,
      NOW
    )

    expect(report.summary.totalTeams).toBe(3)
    expect(report.summary.includedTeams).toBe(1)
    expect(report.summary.excludedTeams).toBe(2)
    expect(report.summary.activeUsersIncluded).toBe(1)
    expect(report.summary.bannedActiveUsersIncluded).toBe(0)
    expect(report.summary.excludedByReason).toEqual({
      [CRM_ENTITLEMENT_REASONS.memberProExpired]: 1,
      [CRM_ENTITLEMENT_REASONS.profileProduct]: 1,
    })
    expect(report.teams).toHaveLength(1)
    expect(report.excluded).toHaveLength(2)
    expect(report.warnings.some((warning) => warning.includes("Member PRO"))).toBe(
      true
    )
    expect(report.checksum).toBe(
      computeCrmEntitlementChecksum(POLICY, report.teams)
    )
  })

  it("mantém checksum estável e muda quando o time muda", () => {
    const first = includedEntry()
    const second = includedEntry({ teamName: "Outro Time" })

    const checksumA = computeCrmEntitlementChecksum(POLICY, [first])
    const checksumB = computeCrmEntitlementChecksum(POLICY, [first])
    const checksumC = computeCrmEntitlementChecksum(POLICY, [second])

    expect(checksumB).toBe(checksumA)
    expect(checksumC).not.toBe(checksumA)
  })

  it("valida produto e política aprovados", () => {
    expect(() =>
      assertApprovedCrmEntitlementPolicy(POLICY, PRODUCT, NOW)
    ).not.toThrow()

    expect(() =>
      assertApprovedCrmEntitlementPolicy(
        POLICY,
        { ...PRODUCT, featureSlugs: ["radar"] },
        NOW
      )
    ).toThrow("featureSlug")

    expect(() =>
      assertApprovedCrmEntitlementPolicy(
        createCrmEntitlementPolicy(OPERATOR_ID),
        PRODUCT,
        new Date("2026-11-20T00:00:00.000Z")
      )
    ).toThrow("expirada")
  })
})

describe("decisão de apply do grant CRM", () => {
  it("aplica quando o time continua elegível", () => {
    const planned = includedEntry()
    const current = includedEntry()

    expect(resolveApplyDecision(planned, current)).toEqual({ action: "apply" })
  })

  it("pula quando o time deixou de ser elegível", () => {
    const planned = includedEntry()
    const current = includedEntry({
      activeBackofficeSubscriptions: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          productId: "55555555-5555-4555-8555-555555555555",
          productName: "CRM",
          featureSlugs: ["crm"],
          status: "active",
          startDate: null,
          endDate: new Date(POLICY.expiry),
        },
      ],
    })

    expect(resolveApplyDecision(planned, current)).toEqual({
      action: "skip",
      reason: CRM_ENTITLEMENT_REASONS.activeBackofficeSubscription,
    })
  })

  it("conflita quando a grace do lote mudou", () => {
    const planned = includedEntry()
    const current = includedEntry({
      activeGraces: [
        {
          ...GRACE,
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        },
      ],
    })

    expect(resolveApplyDecision(planned, current)).toEqual({
      action: "conflict",
      reason: "grace do lote mudou desde o dry-run",
    })
  })

  it("conflita quando o master mudou", () => {
    const planned = includedEntry()
    const current = includedEntry({
      masterId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    })

    expect(resolveApplyDecision(planned, current)).toEqual({
      action: "conflict",
      reason: "master do time mudou desde o dry-run",
    })
  })
})
