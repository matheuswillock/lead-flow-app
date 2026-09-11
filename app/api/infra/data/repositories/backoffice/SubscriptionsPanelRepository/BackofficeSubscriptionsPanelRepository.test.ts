import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyMock = mock(async () => [] as unknown[])
const countMock = mock(async () => 0)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findMany: findManyMock },
    backofficeAdhesion: { count: countMock },
  },
}))

const { BackofficeSubscriptionsPanelRepository } = await import("./BackofficeSubscriptionsPanelRepository")

beforeEach(() => {
  findManyMock.mockClear()
})

describe("findActiveMastersForPanel — normalização de ciclo legado (achado cursor[bot] no PR #1134)", () => {
  it("sem adesão, subscriptionCycle=YEARLY (enum legado) → cycle normalizado 'annual' (não 'yearly')", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "master-1",
        hasPermanentSubscription: false,
        asaasSubscriptionId: null,
        asaasSubscriptionAccount: "primary",
        subscription: {
          subscriptionStatus: "active",
          subscriptionCycle: "YEARLY",
          subscriptionNextDueDate: null,
          subscriptionEndDate: null,
          product: { name: "CRM" },
          adhesion: null,
        },
      },
    ])

    const repository = new BackofficeSubscriptionsPanelRepository()
    const records = await repository.findActiveMastersForPanel()

    expect(records[0].cycle).toBe("annual")
  })

  it("sem adesão, subscriptionCycle=SEMIANNUALLY (enum legado) → cycle normalizado 'semiannual'", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "master-2",
        hasPermanentSubscription: false,
        asaasSubscriptionId: null,
        asaasSubscriptionAccount: "primary",
        subscription: {
          subscriptionStatus: "active",
          subscriptionCycle: "SEMIANNUALLY",
          subscriptionNextDueDate: null,
          subscriptionEndDate: null,
          product: { name: "CRM" },
          adhesion: null,
        },
      },
    ])

    const repository = new BackofficeSubscriptionsPanelRepository()
    const records = await repository.findActiveMastersForPanel()

    expect(records[0].cycle).toBe("semiannual")
  })
})
