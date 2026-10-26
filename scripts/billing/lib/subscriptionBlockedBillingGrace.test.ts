import { describe, expect, it } from "bun:test"
import {
  assertApprovedCensusPolicy,
  buildCensusReport,
  buildGraceReason,
  CENSUS_REASONS,
  classifyTeamSnapshot,
  computeCensusChecksum,
  DEFAULT_CENSUS_POLICY,
  resolveApplyDecision,
  SUBSCRIPTION_BLOCKED_GRACE_EXPIRY,
  type SubscriptionSnapshot,
  type TeamBillingSnapshot,
} from "./subscriptionBlockedBillingGrace"

const NOW = new Date("2026-10-19T12:00:00.000Z")

function subscription(
  overrides: Partial<SubscriptionSnapshot> = {}
): SubscriptionSnapshot {
  return {
    subscriptionStatus: "past_due",
    subscriptionNextDueDate: null,
    hasPermanentSubscription: false,
    subscriptionCycle: "monthly",
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    ...overrides,
  }
}

function baseSnapshot(
  overrides: Partial<TeamBillingSnapshot> = {}
): TeamBillingSnapshot {
  return {
    teamId: "11111111-1111-4111-8111-111111111111",
    teamName: "Time Teste",
    masterId: "22222222-2222-4222-8222-222222222222",
    masterEmail: "master@example.com",
    masterName: "Master",
    masterDeleted: false,
    profileSubscription: subscription(),
    canonicalSubscription: null,
    memberPro: null,
    masterBans: [],
    activeGraces: [],
    activeUsers: [
      { id: "33333333-3333-4333-8333-333333333333", email: "user@example.com", fullName: "User" },
    ],
    activeUserBans: [],
    ...overrides,
  }
}

function expiredGrace(id = "grace-expired") {
  return {
    id,
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    isActive: true,
    reason: "grace anterior",
    grantedByProfileId: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  }
}

function futureGrace(id = "grace-future") {
  return {
    id,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    isActive: true,
    reason: "grace futura",
    grantedByProfileId: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
  }
}

describe("subscription-blocked billing grace policy", () => {
  it("inclui past_due sem grace e planeja grant", () => {
    const entry = classifyTeamSnapshot(baseSnapshot(), NOW)

    expect(entry.decision).toBe("included")
    expect(entry.reason).toBe(CENSUS_REASONS.pastDue)
    expect(entry.action).toBe("grant")
    expect(entry.currentGrace).toBeNull()
    expect(entry.activeUsers).toBe(1)
  })

  it("inclui vencimento passado mesmo com status active", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({
          subscriptionStatus: "active",
          subscriptionNextDueDate: new Date("2026-10-18T00:00:00.000Z"),
        }),
      }),
      NOW
    )

    expect(entry.decision).toBe("included")
    expect(entry.reason).toBe(CENSUS_REASONS.dueDate)
    expect(entry.subscriptionStatus).toBe("active")
  })

  it("inclui suspended e canceled", () => {
    const suspended = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({ subscriptionStatus: "suspended" }),
      }),
      NOW
    )
    const canceled = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({ subscriptionStatus: "canceled" }),
      }),
      NOW
    )

    expect(suspended.decision).toBe("included")
    expect(suspended.reason).toBe(CENSUS_REASONS.suspended)
    expect(canceled.decision).toBe("included")
    expect(canceled.reason).toBe(CENSUS_REASONS.canceled)
  })

  it("exclui assinatura permanente", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({
          subscriptionStatus: "active",
          hasPermanentSubscription: true,
        }),
      }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.allowedPermanent)
    expect(entry.action).toBeNull()
  })

  it("exclui assinatura anual válida", () => {
    const annual = subscription({
      subscriptionStatus: "active",
      subscriptionCycle: "annual",
      subscriptionStartDate: new Date("2026-01-01T00:00:00.000Z"),
      subscriptionEndDate: new Date("2027-01-01T00:00:00.000Z"),
      subscriptionNextDueDate: new Date("2027-01-01T00:00:00.000Z"),
    })

    const entry = classifyTeamSnapshot(
      baseSnapshot({ profileSubscription: annual }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.allowedAnnual)
  })

  it("exclui Member PRO ativo", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        memberPro: {
          slug: "member_pro",
          accessStartsAt: null,
          accessExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
        },
      }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.allowedMemberPro)
  })

  it("inclui Member PRO expirado por política aprovada", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        memberPro: {
          slug: "member_pro",
          accessStartsAt: null,
          accessExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      }),
      NOW
    )

    expect(entry.decision).toBe("included")
    expect(entry.reason).toBe(CENSUS_REASONS.memberProExpired)
    expect(entry.action).toBe("grant")
    expect(entry.memberProExpiresAt).toBe("2026-10-01T00:00:00.000Z")
  })

  it("exclui Member PRO expirado quando a política não permite", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        memberPro: {
          slug: "member_pro",
          accessStartsAt: null,
          accessExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      }),
      NOW,
      { ...DEFAULT_CENSUS_POLICY, includeExpiredMemberPro: false }
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.memberProExpired)
  })

  it("exclui master banido em ACCOUNT ou INDIVIDUAL", () => {
    for (const scope of ["ACCOUNT", "INDIVIDUAL"]) {
      const entry = classifyTeamSnapshot(
        baseSnapshot({
          masterBans: [
            {
              id: `ban-${scope}`,
              profileId: "22222222-2222-4222-8222-222222222222",
              scope,
              email: "master@example.com",
              reason: "teste",
            },
          ],
        }),
        NOW
      )

      expect(entry.decision).toBe("excluded")
      expect(entry.reason).toBe(CENSUS_REASONS.bannedMaster)
      expect(entry.masterBans).toHaveLength(1)
    }
  })

  it("exclui master removido", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({ masterDeleted: true }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.reviewMasterDeleted)
  })

  it("exclui grace ativo futuro", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [futureGrace()] }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.allowedGrace)
  })

  it("repara grace expirado em vez de criar outro", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [expiredGrace("grace-antigo")] }),
      NOW
    )

    expect(entry.decision).toBe("included")
    expect(entry.reason).toBe(CENSUS_REASONS.pastDue)
    expect(entry.action).toBe("repair-expiry")
    expect(entry.currentGrace?.id).toBe("grace-antigo")
    expect(entry.currentGrace?.expiresAt).toBe("2026-10-01T00:00:00.000Z")
  })

  it("marca múltiplos graces expirados como revisão", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        activeGraces: [expiredGrace("grace-1"), expiredGrace("grace-2")],
      }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.reviewMultipleExpiredGraces)
  })

  it("exclui subscription_unavailable", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({
          subscriptionStatus: null,
          subscriptionCycle: null,
        }),
      }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.reviewSubscriptionUnavailable)
  })

  it("mantém ban individual de membro sem excluir o time", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        activeUsers: [
          { id: "33333333-3333-4333-8333-333333333333", email: "user@example.com", fullName: "User" },
          { id: "44444444-4444-4444-8444-444444444444", email: "bruna@example.com", fullName: "Bruna" },
        ],
        activeUserBans: [
          {
            id: "ban-bruna",
            profileId: "44444444-4444-4444-8444-444444444444",
            scope: "INDIVIDUAL",
            email: "bruna@example.com",
            reason: "ban individual",
          },
        ],
      }),
      NOW
    )

    expect(entry.decision).toBe("included")
    expect(entry.activeUsers).toBe(2)
    expect(entry.bannedActiveUsers).toEqual([
      {
        profileId: "44444444-4444-4444-8444-444444444444",
        email: "bruna@example.com",
        scope: "INDIVIDUAL",
      },
    ])
  })

  it("dá precedência à assinatura canônica sobre a do profile", () => {
    const profileAnnual = subscription({
      subscriptionStatus: "active",
      subscriptionCycle: "annual",
      subscriptionStartDate: new Date("2026-01-01T00:00:00.000Z"),
      subscriptionEndDate: new Date("2027-01-01T00:00:00.000Z"),
      subscriptionNextDueDate: new Date("2027-01-01T00:00:00.000Z"),
    })

    const canonicalPastDue = subscription({ subscriptionStatus: "past_due" })
    const blocked = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: profileAnnual,
        canonicalSubscription: canonicalPastDue,
      }),
      NOW
    )

    const canonicalAnnual = profileAnnual
    const allowed = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({ subscriptionStatus: "past_due" }),
        canonicalSubscription: canonicalAnnual,
      }),
      NOW
    )

    expect(blocked.decision).toBe("included")
    expect(blocked.reason).toBe(CENSUS_REASONS.pastDue)
    expect(allowed.decision).toBe("excluded")
    expect(allowed.reason).toBe(CENSUS_REASONS.allowedAnnual)
  })

  it("exclui assinatura ativa/trial em dia", () => {
    const entry = classifyTeamSnapshot(
      baseSnapshot({
        profileSubscription: subscription({
          subscriptionStatus: "active",
          subscriptionNextDueDate: new Date("2026-11-01T00:00:00.000Z"),
        }),
      }),
      NOW
    )

    expect(entry.decision).toBe("excluded")
    expect(entry.reason).toBe(CENSUS_REASONS.allowedStatus)
  })

  it("gera checksum estável e sensível ao time", () => {
    const first = classifyTeamSnapshot(baseSnapshot(), NOW)
    const report = buildCensusReport([first], NOW)
    const sameReport = buildCensusReport(
      [classifyTeamSnapshot(baseSnapshot(), NOW)],
      NOW
    )
    const differentReport = buildCensusReport(
      [
        classifyTeamSnapshot(
          baseSnapshot({ teamId: "55555555-5555-4555-8555-555555555555" }),
          NOW
        ),
      ],
      NOW
    )

    expect(computeCensusChecksum(report.policy, report.teams)).toBe(report.checksum)
    expect(sameReport.checksum).toBe(report.checksum)
    expect(differentReport.checksum).not.toBe(report.checksum)
  })

  it("resolve apply, skip e conflito", () => {
    const planned = classifyTeamSnapshot(baseSnapshot(), NOW)
    const current = classifyTeamSnapshot(baseSnapshot(), NOW)
    const alreadyAllowed = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [futureGrace()] }),
      NOW
    )
    const currentRepair = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [expiredGrace("grace-antigo")] }),
      NOW
    )
    const plannedRepair = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [expiredGrace("grace-antigo")] }),
      NOW
    )
    const currentDifferentGrace = classifyTeamSnapshot(
      baseSnapshot({ activeGraces: [expiredGrace("grace-novo")] }),
      NOW
    )

    expect(resolveApplyDecision(planned, current)).toEqual({ action: "apply" })
    expect(resolveApplyDecision(planned, alreadyAllowed)).toEqual({
      action: "skip",
      reason: CENSUS_REASONS.allowedGrace,
    })
    expect(resolveApplyDecision(planned, currentRepair)).toEqual({
      action: "conflict",
      reason: "ação mudou de grant para repair-expiry",
    })
    expect(
      resolveApplyDecision(plannedRepair, currentDifferentGrace)
    ).toEqual({
      action: "conflict",
      reason: "grace ativa/expiração existente mudou desde o dry-run",
    })
  })

  it("formata a data final da grace em São Paulo", () => {
    expect(buildGraceReason()).toContain("18/11/2026")
  })

  it("rejeita política fora do aprovado ou expirada", () => {
    expect(() => assertApprovedCensusPolicy(DEFAULT_CENSUS_POLICY, NOW)).not.toThrow()
    expect(() =>
      assertApprovedCensusPolicy(
        {
          ...DEFAULT_CENSUS_POLICY,
          expiry: "2026-10-01T00:00:00.000Z",
        },
        NOW
      )
    ).toThrow("não aprovada")
    expect(() =>
      assertApprovedCensusPolicy(
        DEFAULT_CENSUS_POLICY,
        new Date("2026-11-20T00:00:00.000Z")
      )
    ).toThrow("expirada")
    expect(() =>
      assertApprovedCensusPolicy(
        {
          ...DEFAULT_CENSUS_POLICY,
          includeExpiredMemberPro: false,
        },
        NOW
      )
    ).toThrow("Member PRO")
  })

  it("expiração aprovada continua no futuro para o relatório", () => {
    expect(new Date(SUBSCRIPTION_BLOCKED_GRACE_EXPIRY).getTime()).toBeGreaterThan(
      NOW.getTime()
    )
  })
})
