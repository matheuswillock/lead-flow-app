import { beforeEach, describe, expect, it, mock } from "bun:test"

const profileFindUnique = mock(async (input: { where: { supabaseId?: string; id?: string } }) => {
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

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    team: { findFirst: mock(async () => null) },
    teamMember: { findFirst: mock(async () => null) },
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
    migrationFindFirst.mockResolvedValue({ quoteSnapshot: { recurringAmount: 59.9 } })
    accountMasterBanned.mockResolvedValue(false)
  })

  it("não consulta migrações de cartão ao resolver uma conta inadimplente", async () => {
    const record = await new AccountAccessDecisionRepository().resolveAccount({ profileId: "owner-1" })

    expect(record?.subscriptionStatus).toBe("past_due")
    expect(migrationFindFirst).not.toHaveBeenCalled()
  })
})
