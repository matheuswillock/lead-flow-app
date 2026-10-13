import { beforeEach, describe, expect, it, mock } from "bun:test"

const profileFindUnique = mock(async (input: { where: { supabaseId?: string; id?: string } }): Promise<any> => {
  if (input.where.supabaseId) return { id: "owner-1" }
  return {
    id: "owner-1",
    managerId: null,
    activeTeamId: null,
    hasPermanentSubscription: false,
    subscriptionNextDueDate: null,
    subscriptionStatus: "past_due",
    subscription: {
      hasPermanentSubscription: false,
      subscriptionNextDueDate: null,
      subscriptionStatus: "past_due",
    },
  }
})
const migrationFindFirst = mock(async (): Promise<{ quoteSnapshot: { recurringAmount: number } | null }> => ({
  quoteSnapshot: { recurringAmount: 59.9 },
}))
const accountMasterBanned = mock(async () => false)
const teamFindFirst = mock(async (): Promise<any> => null)
const teamMemberFindFirst = mock(async (): Promise<any> => null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    team: { findFirst: teamFindFirst },
    teamMember: { findFirst: teamMemberFindFirst },
    asaasAccountMigration: { findFirst: migrationFindFirst },
  },
}))
mock.module("@/lib/account/isAccountMasterBanned", () => ({
  isAccountMasterBanned: accountMasterBanned,
}))

const { AccountAccessDecisionRepository } = await import("./AccountAccessDecisionRepository")

describe("AccountAccessDecisionRepository bloqueio sem recuperação por cartão", () => {
  beforeEach(() => {
    profileFindUnique.mockClear()
    migrationFindFirst.mockClear()
    accountMasterBanned.mockClear()
    teamFindFirst.mockReset()
    teamMemberFindFirst.mockReset()
    migrationFindFirst.mockResolvedValue({ quoteSnapshot: { recurringAmount: 59.9 } })
    accountMasterBanned.mockResolvedValue(false)
    teamFindFirst.mockResolvedValue(null)
    teamMemberFindFirst.mockResolvedValue(null)
  })

  it("não consulta migrações de cartão ao resolver uma conta inadimplente", async () => {
    const record = await new AccountAccessDecisionRepository().resolveAccount({ profileId: "owner-1" })

    expect(record?.subscriptionStatus).toBe("past_due")
    expect(migrationFindFirst).not.toHaveBeenCalled()
  })

  it("mantém o master do time como owner mesmo com managerId legado", async () => {
    profileFindUnique.mockResolvedValueOnce({
      id: "owner-1",
      managerId: "legacy-manager",
      activeTeamId: "team-1",
      hasPermanentSubscription: false,
      subscriptionNextDueDate: null,
      subscriptionStatus: "active",
      subscription: {
        hasPermanentSubscription: false,
        subscriptionNextDueDate: null,
        subscriptionStatus: "active",
      },
    })
    profileFindUnique.mockResolvedValueOnce({
      id: "owner-1",
      hasPermanentSubscription: false,
      subscriptionNextDueDate: null,
      subscriptionStatus: "past_due",
      subscription: {
        hasPermanentSubscription: false,
        subscriptionNextDueDate: null,
        subscriptionStatus: "past_due",
      },
      userTypeAssignment: null,
    })
    teamFindFirst.mockResolvedValue({
      masterId: "owner-1",
      master: { sponsorMasterId: null },
    })
    teamMemberFindFirst.mockResolvedValue(null)

    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "owner-1",
      teamId: "team-1",
    })

    expect(record?.billingOwnerId).toBe("owner-1")
    expect(record?.subscriptionStatus).toBe("past_due")
  })

  it("não usa o managerId quando o teamId explícito não pertence ao usuário", async () => {
    profileFindUnique.mockResolvedValueOnce({
      id: "member-1",
      managerId: "legacy-manager",
      activeTeamId: "other-team",
    })
    teamFindFirst.mockResolvedValue({
      masterId: "account-owner",
      master: { sponsorMasterId: null },
    })
    teamMemberFindFirst.mockResolvedValue(null)

    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "member-1",
      teamId: "unauthorized-team",
    })

    expect(record).toBeNull()
    expect(accountMasterBanned).not.toHaveBeenCalled()
  })
})
