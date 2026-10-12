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

describe("AccountAccessDecisionRepository card recovery", () => {
  beforeEach(() => {
    profileFindUnique.mockClear()
    migrationFindFirst.mockClear()
    accountMasterBanned.mockClear()
    migrationFindFirst.mockResolvedValue({ quoteSnapshot: { recurringAmount: 59.9 } })
    accountMasterBanned.mockResolvedValue(false)
  })

  it("marca somente uma migração pausada com snapshot como recuperável", async () => {
    const record = await new AccountAccessDecisionRepository().resolveAccount({ profileId: "owner-1" })

    expect(record?.canRecoverCard).toBe(true)
    expect(migrationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        profileId: "owner-1",
        status: "paused_awaiting_card",
        primaryCustomerId: { not: null },
      }),
    }))
  })

  it("não marca recuperação quando o snapshot está ausente", async () => {
    migrationFindFirst.mockResolvedValueOnce({ quoteSnapshot: null })

    const record = await new AccountAccessDecisionRepository().resolveAccount({ profileId: "owner-1" })

    expect(record?.canRecoverCard).toBe(false)
  })
})
