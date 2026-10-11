import { beforeEach, describe, expect, it, mock } from "bun:test"

const updateManyMock = mock(async () => ({ count: 0 }))
const findUniqueMock = mock(async () => ({
  id: "reauth-1",
  expiresAt: new Date("2026-10-11T12:00:00.000Z"),
  usedAt: null,
  migration: { profileId: "profile-1" },
}))
const declinedCountMock = mock(async () => 0)
const oldestDeclineMock = mock(async () => ({ createdAt: new Date("2026-10-10T08:00:00.000Z") }))
const createAttemptMock = mock(async () => ({ id: "attempt-1" }))
const updateAttemptMock = mock(async () => ({ id: "attempt-1" }))
const findForMasterRecordMock = mock(async () => null as any)
const findProfileMock = mock(async () => null as any)
const isAccountMasterBannedMock = mock(async () => false)
const transactionMock = mock(async (callback: (transaction: any) => unknown) => callback({
  asaasCardReauthorization: {
    findUnique: findUniqueMock,
    updateMany: updateManyMock,
  },
  asaasCardReauthorizationAttempt: {
    count: declinedCountMock,
    findFirst: oldestDeclineMock,
    create: createAttemptMock,
    updateMany: updateAttemptMock,
  },
}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    asaasCardReauthorization: {
      findUnique: findForMasterRecordMock,
      updateMany: updateManyMock,
    },
    asaasCardReauthorizationAttempt: {
      updateMany: updateAttemptMock,
    },
    profile: { findUnique: findProfileMock },
  },
}))
mock.module("@/lib/account/isAccountMasterBanned", () => ({
  isAccountMasterBanned: isAccountMasterBannedMock,
}))

const { AsaasCardReauthorizationRepository } = await import("./AsaasCardReauthorizationRepository")

describe("AsaasCardReauthorizationRepository claim", () => {
  beforeEach(() => {
    updateManyMock.mockReset()
    findUniqueMock.mockReset()
    declinedCountMock.mockReset()
    oldestDeclineMock.mockReset()
    createAttemptMock.mockReset()
    updateAttemptMock.mockReset()
    findForMasterRecordMock.mockReset()
    findProfileMock.mockReset()
    isAccountMasterBannedMock.mockReset()
    isAccountMasterBannedMock.mockResolvedValue(false)
    findUniqueMock.mockResolvedValue({
      id: "reauth-1",
      expiresAt: new Date("2026-10-11T12:00:00.000Z"),
      usedAt: null,
      migration: { profileId: "profile-1" },
    })
    declinedCountMock.mockResolvedValue(0)
    oldestDeclineMock.mockResolvedValue({ createdAt: new Date("2026-10-10T08:00:00.000Z") })
    createAttemptMock.mockResolvedValue({ id: "attempt-1" })
  })

  it("claims an unused token only when no active processor owns it", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 })
    const repository = new AsaasCardReauthorizationRepository()

    const claimed = await repository.claimForProcessing({
      id: "reauth-1",
      masterProfileId: "profile-1",
      processingOwner: "worker-1",
      now: new Date("2026-10-10T12:00:00.000Z"),
      leaseDurationMs: 300_000,
    })

    expect(claimed).toEqual(expect.objectContaining({
      kind: "claimed",
      attemptId: expect.any(String),
      attemptReference: expect.stringContaining("asaas-card-attempt:"),
    }))
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "reauth-1", usedAt: null, OR: expect.any(Array) }),
      data: expect.objectContaining({ processingOwner: "worker-1" }),
    }))
    expect(createAttemptMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reauthorizationId: "reauth-1",
        masterProfileId: "profile-1",
        status: "processing",
      }),
    }))
  })

  it("rejects a second processor while the lease is active", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 })
    const repository = new AsaasCardReauthorizationRepository()

    await expect(repository.claimForProcessing({
      id: "reauth-1",
      masterProfileId: "profile-1",
      processingOwner: "worker-2",
      now: new Date("2026-10-10T12:00:00.000Z"),
      leaseDurationMs: 300_000,
    })).resolves.toEqual({ kind: "already_processing" })
    expect(createAttemptMock).not.toHaveBeenCalled()
  })

  it("bloqueia por 24 horas depois de cinco recusas", async () => {
    declinedCountMock.mockResolvedValueOnce(5)
    const repository = new AsaasCardReauthorizationRepository()

    const result = await repository.claimForProcessing({
      id: "reauth-1",
      masterProfileId: "profile-1",
      processingOwner: "worker-3",
      now: new Date("2026-10-10T12:00:00.000Z"),
      leaseDurationMs: 300_000,
    })

    expect(result).toEqual(expect.objectContaining({ kind: "rate_limited" }))
    expect(updateManyMock).not.toHaveBeenCalled()
    expect(createAttemptMock).not.toHaveBeenCalled()
    expect(declinedCountMock).toHaveBeenCalledWith({
      where: {
        reauthorizationId: "reauth-1",
        status: "declined",
        createdAt: { gte: new Date("2026-10-09T12:00:00.000Z") },
      },
    })
  })

  it("registra somente outcome seguro, sem dados do cartão", async () => {
    updateAttemptMock.mockResolvedValueOnce({ count: 1 })
    const repository = new AsaasCardReauthorizationRepository()

    await repository.completeAttempt({
      attemptId: "attempt-1",
      status: "declined",
      failureCode: "PAYMENT_DECLINED",
      completedAt: new Date("2026-10-10T12:01:00.000Z"),
    })

    expect(updateAttemptMock).toHaveBeenCalledWith({
      where: { id: "attempt-1", status: "processing" },
      data: {
        status: "declined",
        failureCode: "PAYMENT_DECLINED",
        completedAt: new Date("2026-10-10T12:01:00.000Z"),
      },
    })
  })

  it("propaga o banimento do master autenticado sem expor o token", async () => {
    findForMasterRecordMock.mockResolvedValueOnce({
      id: "reauth-1",
      expiresAt: new Date("2026-10-11T12:00:00.000Z"),
      usedAt: null,
      migration: {
        id: "migration-1",
        profileId: "profile-1",
        legacyCustomerId: "cus-legacy",
        clientName: "Cliente",
        clientEmail: "cliente@example.com",
        quoteSnapshot: {},
        status: "requires_card_reauth",
        primaryCustomerId: "cus-primary",
      },
    })
    findProfileMock.mockResolvedValueOnce({
      supabaseId: "supabase-master",
      isMaster: true,
    })
    isAccountMasterBannedMock.mockResolvedValueOnce(true)
    const repository = new AsaasCardReauthorizationRepository()

    const result = await repository.findForMaster("raw-secret-token", "supabase-master")

    expect(result).toEqual(expect.objectContaining({ isBanned: true }))
    expect(isAccountMasterBannedMock).toHaveBeenCalledWith("profile-1")
    expect(findForMasterRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.not.stringContaining("raw-secret-token") },
    }))
  })
})
