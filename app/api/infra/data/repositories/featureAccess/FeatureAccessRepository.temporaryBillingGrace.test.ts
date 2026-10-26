import { beforeEach, describe, expect, it, mock } from "bun:test"

const billingAccessGraceFindFirst = mock(async (_input: { where: Record<string, unknown> }): Promise<{ id: string } | null> => ({ id: "grace-1" }))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { billingAccessGrace: { findFirst: billingAccessGraceFindFirst } },
}))

const { FeatureAccessRepository } = await import("./FeatureAccessRepository")

describe("FeatureAccessRepository.hasActiveTemporaryBillingGrace", () => {
  beforeEach(() => billingAccessGraceFindFirst.mockReset())

  it("considera somente concessões do time ainda não expiradas", async () => {
    billingAccessGraceFindFirst.mockResolvedValueOnce({ id: "grace-1" })

    const hasGrace = await new FeatureAccessRepository().hasActiveTemporaryBillingGrace("team-pertto")

    expect(hasGrace).toBe(true)
    expect(billingAccessGraceFindFirst).toHaveBeenCalledTimes(1)
    const query = billingAccessGraceFindFirst.mock.calls[0]?.[0]
    expect(query?.where).toMatchObject({
      teamId: "team-pertto",
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
    })
  })

  it("considera concessão operacional sem expiração", async () => {
    billingAccessGraceFindFirst.mockResolvedValueOnce({ id: "grace-indefinite" })

    const hasGrace = await new FeatureAccessRepository().hasActiveTemporaryBillingGrace("team-rcacc")

    expect(hasGrace).toBe(true)
    expect(billingAccessGraceFindFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        teamId: "team-rcacc",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
    })
  })

  it("não reconhece concessão ausente ou expirada", async () => {
    billingAccessGraceFindFirst.mockResolvedValueOnce(null)

    const hasGrace = await new FeatureAccessRepository().hasActiveTemporaryBillingGrace("team-pertto")

    expect(hasGrace).toBe(false)
  })
})
