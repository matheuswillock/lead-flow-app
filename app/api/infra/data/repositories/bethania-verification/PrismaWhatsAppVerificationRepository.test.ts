import { describe, expect, it, mock } from "bun:test"

const updateMany = mock(async (_args: unknown) => ({ count: 1 }))
const findUnique = mock(async () => ({ id: "profile-1" }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique },
    bethaniaVerificationChallenge: { updateMany },
  },
}))

const { PrismaWhatsAppVerificationRepository } = await import("./PrismaWhatsAppVerificationRepository")

describe("PrismaWhatsAppVerificationRepository.incrementFailedAttempt", () => {
  it("increments attempts atomically up to maxAttempts without matching stale expectedAttempts", async () => {
    updateMany.mockClear()
    const repository = new PrismaWhatsAppVerificationRepository()
    const now = new Date("2026-11-28T12:00:00.000Z")

    await Promise.all([
      repository.incrementFailedAttempt({ supabaseId: "sub-1", id: "challenge-1", maxAttempts: 5, now }),
      repository.incrementFailedAttempt({ supabaseId: "sub-1", id: "challenge-1", maxAttempts: 5, now }),
    ])

    expect(updateMany).toHaveBeenCalledTimes(2)
    for (const [call] of updateMany.mock.calls) {
      expect(call).toEqual({
        where: {
          id: "challenge-1",
          profileId: "profile-1",
          consumedAt: null,
          attempts: { lt: 5 },
          expiresAt: { gt: now },
        },
        data: { attempts: { increment: 1 } },
      })
    }
  })
})
