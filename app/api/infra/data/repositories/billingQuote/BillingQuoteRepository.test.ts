import { describe, expect, it, mock } from "bun:test"

const profileFindUnique = mock(async () => ({
  id: "owner-1",
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  asaasSubscriptionId: "sub_profile",
  asaasSubscriptionAccount: "legacy",
  subscriptionCycle: "MONTHLY",
}))
const subscriptionFindUnique = mock(async () => ({
  hasPermanentSubscription: false,
  asaasSubscriptionId: "sub_subscription",
  asaasSubscriptionAccount: "primary",
  subscriptionCycle: "QUARTERLY",
  product: {
    id: "base",
    name: "CRM",
    featureSlugs: ["crm"],
    priceMonthly: { toString: () => "59.90" },
    priceQuarterly: { toString: () => "179.70" },
    isActive: true,
  },
  adhesion: { monthlyBaseAmount: { toString: () => "79.90" }, status: "paid" },
    includedExtraTeams: 0,
  capacity: {
    includedExtraUsers: 0,
    manualAdjustmentExtraTeams: 0,
    manualAdjustmentExtraUsers: 0,
  },
}))
const teamCount = mock(async () => 2)
const teamMemberFindMany = mock(async () => [
  { profileId: "owner-1" },
  { profileId: "member-1" },
  { profileId: "member-2" },
])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    profileSubscription: { findUnique: subscriptionFindUnique },
    team: { count: teamCount },
    teamMember: { findMany: teamMemberFindMany },
  },
}))

const { BillingQuoteRepository } = await import("./BillingQuoteRepository")

describe("BillingQuoteRepository", () => {
  it("conta membros ativos distintos e usa o ponteiro da ProfileSubscription", async () => {
    const productRepository = {
      findDefaultByFeatureSlug: mock(async (slug: string) => ({
        id: slug,
        name: slug,
        featureSlugs: [slug],
        priceMonthly: { toString: () => (slug === "extra-user" ? "19.90" : "29.90") },
        priceQuarterly: { toString: () => (slug === "extra-user" ? "59.70" : "89.70") },
        isActive: true,
      })),
    }
    const repository = new BillingQuoteRepository(productRepository as never)

    const projection = await repository.getProjection("owner-1")

    expect(projection?.billableActiveMembers).toBe(3)
    expect(projection?.activeTeams).toBe(2)
    expect(projection?.asaasSubscriptionId).toBe("sub_subscription")
    expect(projection?.asaasSubscriptionAccount).toBe("primary")
    expect(projection?.billingCycle).toBe("quarterly")
    expect(projection?.baseProduct?.unitAmount).toBe(239.7)
    expect(teamMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { team: { masterId: "owner-1", deletedAt: null }, profile: { deletedAt: null } },
        distinct: ["profileId"],
      })
    )
  })

  it("não reutiliza o ponteiro do Profile quando já existe ProfileSubscription", async () => {
    subscriptionFindUnique.mockImplementationOnce(async () => ({
      hasPermanentSubscription: false,
      asaasSubscriptionId: null,
      asaasSubscriptionAccount: "primary",
      subscriptionCycle: "MONTHLY",
      product: {
        id: "base",
        name: "CRM",
        featureSlugs: ["crm"],
        priceMonthly: { toString: () => "59.90" },
        priceQuarterly: null,
        isActive: true,
      },
      capacity: {
        includedExtraTeams: 0,
        includedExtraUsers: 0,
        manualAdjustmentExtraTeams: 0,
        manualAdjustmentExtraUsers: 0,
      },
    }) as never)
    const productRepository = {
      findDefaultByFeatureSlug: mock(async (slug: string) => ({
        id: slug,
        name: slug,
        featureSlugs: [slug],
        priceMonthly: { toString: () => "19.90" },
        priceQuarterly: null,
        isActive: true,
      })),
    }
    const repository = new BillingQuoteRepository(productRepository as never)

    const projection = await repository.getProjection("owner-1")

    expect(projection?.asaasSubscriptionId).toBeNull()
    expect(projection?.asaasSubscriptionAccount).toBeNull()
  })
})
