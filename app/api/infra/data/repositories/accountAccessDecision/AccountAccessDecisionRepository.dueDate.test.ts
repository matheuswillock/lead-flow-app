import { beforeEach, describe, expect, it, mock } from "bun:test"

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

let profileDueDate: Date | null = null
let subscriptionDueDate: Date | null = null
let hasSubscription = true

const profileFindUnique = mock(async (input: { where: { supabaseId?: string; id?: string } }): Promise<any> => {
  if (input.where.supabaseId) return { id: "owner-1" }
  return {
    id: "owner-1",
    managerId: null,
    activeTeamId: null,
    hasPermanentSubscription: false,
    subscriptionNextDueDate: profileDueDate,
    subscriptionStatus: "past_due",
    subscription: hasSubscription
      ? {
          hasPermanentSubscription: false,
          subscriptionNextDueDate: subscriptionDueDate,
          subscriptionStatus: "past_due",
        }
      : null,
  }
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    team: { findFirst: mock(async () => null) },
    teamMember: { findFirst: mock(async () => null) },
    billingAccessGrace: { findFirst: mock(async () => null) },
    asaasAccountMigration: { findFirst: mock(async () => null) },
  },
}))
mock.module("@/lib/account/isAccountMasterBanned", () => ({
  isAccountMasterBanned: mock(async () => false),
}))

const { AccountAccessDecisionRepository } = await import("./AccountAccessDecisionRepository")

describe("AccountAccessDecisionRepository — data de vencimento contada a partir da mais antiga", () => {
  beforeEach(() => {
    profileDueDate = null
    subscriptionDueDate = null
    hasSubscription = true
  })

  const resolveDueDate = async () =>
    (await new AccountAccessDecisionRepository().resolveAccount({ profileId: "owner-1" }))
      ?.subscriptionNextDueDate

  it("assinatura recente e perfil antigo: vale a do perfil, a mais antiga", async () => {
    subscriptionDueDate = daysAgo(2)
    profileDueDate = daysAgo(20)

    expect((await resolveDueDate())?.getTime()).toBe(profileDueDate.getTime())
  })

  it("assinatura antiga e perfil recente: vale a da assinatura, a mais antiga", async () => {
    subscriptionDueDate = daysAgo(20)
    profileDueDate = daysAgo(2)

    expect((await resolveDueDate())?.getTime()).toBe(subscriptionDueDate.getTime())
  })

  it("só uma das datas existe: usa essa, sem inventar atraso", async () => {
    subscriptionDueDate = null
    profileDueDate = daysAgo(8)
    expect((await resolveDueDate())?.getTime()).toBe(profileDueDate.getTime())

    subscriptionDueDate = daysAgo(8)
    profileDueDate = null
    expect((await resolveDueDate())?.getTime()).toBe(subscriptionDueDate.getTime())
  })

  it("nenhuma data: continua sem data", async () => {
    expect(await resolveDueDate()).toBeNull()
  })

  it("sem assinatura própria: usa a data do perfil", async () => {
    hasSubscription = false
    profileDueDate = daysAgo(12)

    expect((await resolveDueDate())?.getTime()).toBe(profileDueDate.getTime())
  })
})
