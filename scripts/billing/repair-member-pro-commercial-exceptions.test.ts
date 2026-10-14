import { describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  COMMERCIAL_MEMBER_PRO_TARGETS,
  calculateCommercialRepairChecksum,
  type CommercialPlanItem,
  type TargetSnapshot,
  readCommercialDryRunReport,
  resolveCommercialPlanAction,
  validateCommercialTargetSnapshot,
} from "./repair-member-pro-commercial-exceptions"

function snapshotFor(target: (typeof COMMERCIAL_MEMBER_PRO_TARGETS)[number]): TargetSnapshot {
  const hasCorrectAssignment = target.profileId === COMMERCIAL_MEMBER_PRO_TARGETS[0].profileId
  return {
    profileId: target.profileId,
    email: target.email,
    isMaster: true,
    deletedAt: null,
    hasPermanentSubscription: false,
    hasUnlimitedUsers: true,
    subscriptionStartDate: target.accessStartsAt,
    profileSubscriptionStartDate: target.accessStartsAt,
    asaasCustomerId: "cus_test",
    asaasCustomerAccount: "primary",
    asaasSubscriptionId: hasCorrectAssignment ? "sub_test" : null,
    asaasSubscriptionAccount: "primary",
    assignment: hasCorrectAssignment
      ? {
          userTypeSlug: "member_pro",
          accessStartsAt: target.accessStartsAt,
          accessExpiresAt: target.accessExpiresAt,
          assignedByProfileId: null,
        }
      : null,
    team: { id: target.teamId, name: target.teamName, masterId: target.profileId, deletedAt: null },
    activeBan: null,
  }
}

function planItemFor(target: (typeof COMMERCIAL_MEMBER_PRO_TARGETS)[number]): CommercialPlanItem {
  const current = snapshotFor(target)
  return {
    target,
    action: resolveCommercialPlanAction({
      ...current,
      expectedAccessStartsAt: target.accessStartsAt,
      expectedAccessExpiresAt: target.accessExpiresAt,
    }),
    current,
    after: {
      userTypeSlug: "member_pro",
      accessStartsAt: target.accessStartsAt,
      accessExpiresAt: target.accessExpiresAt,
      hasUnlimitedUsers: true,
    },
    asaasMutation: false,
  }
}

describe("repair-member-pro-commercial-exceptions", () => {
  it("mantém o censo com janelas exatas de 100 dias", () => {
    for (const target of COMMERCIAL_MEMBER_PRO_TARGETS) {
      const start = new Date(target.accessStartsAt).getTime()
      const end = new Date(target.accessExpiresAt).getTime()
      expect(end - start).toBe(100 * 24 * 60 * 60 * 1000)
    }
  })

  it("trata Calli como já corrigido", () => {
    const target = COMMERCIAL_MEMBER_PRO_TARGETS[0]
    expect(
      resolveCommercialPlanAction({
        profileId: target.profileId,
        email: target.email,
        isMaster: true,
        deletedAt: null,
        hasPermanentSubscription: false,
        hasUnlimitedUsers: true,
        subscriptionStartDate: target.accessStartsAt,
        profileSubscriptionStartDate: target.accessStartsAt,
        asaasCustomerId: "cus_test",
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: "sub_test",
        asaasSubscriptionAccount: "primary",
        assignment: {
          userTypeSlug: "member_pro",
          accessStartsAt: target.accessStartsAt,
          accessExpiresAt: target.accessExpiresAt,
          assignedByProfileId: null,
        },
        team: { id: target.teamId, name: target.teamName, masterId: target.profileId, deletedAt: null },
        activeBan: null,
        expectedAccessStartsAt: target.accessStartsAt,
        expectedAccessExpiresAt: target.accessExpiresAt,
      })
    ).toBe("already-correct")
  })

  it("planeja criação quando Avantar não possui atribuição", () => {
    const target = COMMERCIAL_MEMBER_PRO_TARGETS[1]
    expect(
      resolveCommercialPlanAction({
        profileId: target.profileId,
        email: target.email,
        isMaster: true,
        deletedAt: null,
        hasPermanentSubscription: false,
        hasUnlimitedUsers: true,
        subscriptionStartDate: target.accessStartsAt,
        profileSubscriptionStartDate: target.accessStartsAt,
        asaasCustomerId: "cus_test",
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: null,
        asaasSubscriptionAccount: "primary",
        assignment: null,
        team: { id: target.teamId, name: target.teamName, masterId: target.profileId, deletedAt: null },
        activeBan: null,
        expectedAccessStartsAt: target.accessStartsAt,
        expectedAccessExpiresAt: target.accessExpiresAt,
      })
    ).toBe("create-member-pro")
  })

  it("gera checksum determinístico para proteger o apply", () => {
    const plan = [] as const
    expect(calculateCommercialRepairChecksum(plan)).toBe(calculateCommercialRepairChecksum(plan))
    expect(calculateCommercialRepairChecksum(plan)).toHaveLength(64)
  })

  it("rejeita outro owner no censo nominal", () => {
    const target = COMMERCIAL_MEMBER_PRO_TARGETS[1]
    expect(() =>
      validateCommercialTargetSnapshot(target, {
        profileId: target.profileId,
        email: target.email,
        isMaster: true,
        deletedAt: null,
        hasPermanentSubscription: false,
        hasUnlimitedUsers: true,
        subscriptionStartDate: target.accessStartsAt,
        profileSubscriptionStartDate: target.accessStartsAt,
        asaasCustomerId: null,
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: null,
        asaasSubscriptionAccount: "primary",
        assignment: null,
        team: { id: target.teamId, name: target.teamName, masterId: "other-owner", deletedAt: null },
        activeBan: null,
      })
    ).toThrow("Time divergente")
  })

  it("rejeita checksum divergente no apply", () => {
    const directory = mkdtempSync(join(tmpdir(), "member-pro-commercial-"))
    const input = join(directory, "dry-run.json")
    try {
      writeFileSync(input, JSON.stringify({ apply: false, plan: [], checksum: "wrong" }), "utf-8")
      expect(() => readCommercialDryRunReport(input, calculateCommercialRepairChecksum([]))).toThrow("checksum divergente")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("mantém o apply restrito ao censo aprovado", () => {
    const directory = mkdtempSync(join(tmpdir(), "member-pro-commercial-census-"))
    const input = join(directory, "dry-run.json")
    try {
      const checksum = calculateCommercialRepairChecksum([])
      writeFileSync(input, JSON.stringify({ apply: false, plan: [], checksum }), "utf-8")
      expect(() => readCommercialDryRunReport(input, checksum)).toThrow("censo comercial aprovado")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("rejeita perfil duplicado mesmo com checksum recalculado", () => {
    const duplicated = planItemFor(COMMERCIAL_MEMBER_PRO_TARGETS[0])
    const plan = [duplicated, duplicated]
    const directory = mkdtempSync(join(tmpdir(), "member-pro-commercial-duplicate-"))
    const input = join(directory, "dry-run.json")
    try {
      const checksum = calculateCommercialRepairChecksum(plan)
      writeFileSync(input, JSON.stringify({ apply: false, plan, checksum }), "utf-8")
      expect(() => readCommercialDryRunReport(input, checksum)).toThrow("perfil duplicado")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("rejeita pós-estado sem usuários ilimitados", () => {
    const first = planItemFor(COMMERCIAL_MEMBER_PRO_TARGETS[0])
    const tampered = structuredClone(first)
    Object.assign(tampered.after, { hasUnlimitedUsers: false })
    const plan = [tampered, planItemFor(COMMERCIAL_MEMBER_PRO_TARGETS[1])]
    const directory = mkdtempSync(join(tmpdir(), "member-pro-commercial-postcondition-"))
    const input = join(directory, "dry-run.json")
    try {
      const checksum = calculateCommercialRepairChecksum(plan)
      writeFileSync(input, JSON.stringify({ apply: false, plan, checksum }), "utf-8")
      expect(() => readCommercialDryRunReport(input, checksum)).toThrow("efeito inválido")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("rejeita ação divergente mesmo com checksum recalculado", () => {
    const target = COMMERCIAL_MEMBER_PRO_TARGETS[0]
    const current = {
      profileId: target.profileId,
      email: target.email,
      isMaster: true,
      deletedAt: null,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: true,
      subscriptionStartDate: target.accessStartsAt,
      profileSubscriptionStartDate: target.accessStartsAt,
      asaasCustomerId: "cus_test",
      asaasCustomerAccount: "primary",
      asaasSubscriptionId: "sub_test",
      asaasSubscriptionAccount: "primary",
      assignment: {
        userTypeSlug: "member_pro",
        accessStartsAt: target.accessStartsAt,
        accessExpiresAt: target.accessExpiresAt,
        assignedByProfileId: null,
      },
      team: { id: target.teamId, name: target.teamName, masterId: target.profileId, deletedAt: null },
      activeBan: null,
    } as const
    const secondTarget = COMMERCIAL_MEMBER_PRO_TARGETS[1]
    const plan = [
      {
        target,
        action: "update-member-pro" as const,
        current,
        after: {
          userTypeSlug: "member_pro" as const,
          accessStartsAt: target.accessStartsAt,
          accessExpiresAt: target.accessExpiresAt,
          hasUnlimitedUsers: true as const,
        },
        asaasMutation: false as const,
      },
      {
        target: secondTarget,
        action: "create-member-pro" as const,
        current: {
          ...current,
          profileId: secondTarget.profileId,
          email: secondTarget.email,
          subscriptionStartDate: secondTarget.accessStartsAt,
          profileSubscriptionStartDate: secondTarget.accessStartsAt,
          asaasSubscriptionId: null,
          assignment: null,
          team: {
            id: secondTarget.teamId,
            name: secondTarget.teamName,
            masterId: secondTarget.profileId,
            deletedAt: null,
          },
        },
        after: {
          userTypeSlug: "member_pro" as const,
          accessStartsAt: secondTarget.accessStartsAt,
          accessExpiresAt: secondTarget.accessExpiresAt,
          hasUnlimitedUsers: true as const,
        },
        asaasMutation: false as const,
      },
    ]
    const directory = mkdtempSync(join(tmpdir(), "member-pro-commercial-action-"))
    const input = join(directory, "dry-run.json")
    try {
      const checksum = calculateCommercialRepairChecksum(plan)
      writeFileSync(input, JSON.stringify({ apply: false, plan, checksum }), "utf-8")
      expect(() => readCommercialDryRunReport(input, checksum)).toThrow("ação divergente")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
