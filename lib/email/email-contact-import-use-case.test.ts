import { beforeEach, describe, expect, it, mock } from "bun:test"

const updateManyMock = mock(async () => ({ count: 0 }))

const transactionMock = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    emailImportJob: {
      findFirst: mock(async () => null),
      updateMany: mock(async () => ({ count: 0 })),
    },
  }
  return fn(tx)
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    emailImportJob: {
      update: mock(async () => ({})),
      updateMany: updateManyMock,
    },
    emailContactList: {
      findFirst: mock(async () => null),
    },
  },
}))

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: mock(async () => {}),
  },
}))

mock.module("@/lib/email/email-import-storage", () => ({
  downloadEmailImportPayload: mock(async () => "[]"),
  uploadEmailImportPayload: mock(async () => "path"),
}))

const { EmailContactImportUseCase } = await import(
  "@/app/api/useCases/email/EmailContactImportUseCase"
)

describe("EmailContactImportUseCase.processPendingJobs", () => {
  beforeEach(() => {
    updateManyMock.mockClear()
    updateManyMock.mockImplementation(async () => ({ count: 0 }))
    transactionMock.mockClear()
  })

  it("retorna sucesso quando não há jobs pendentes", async () => {
    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
  })

  it("reclaim jobs stuck em processing para pending antes do claim", async () => {
    updateManyMock.mockImplementation(async () => ({ count: 2 }))

    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()

    expect(updateManyMock).toHaveBeenCalledTimes(1)
    const callArgs = updateManyMock.mock.calls[0] as unknown as [
      {
        where: { status: string; updatedAt: { lt: Date } }
        data: { status: string }
      },
    ]
    const args = callArgs[0]
    expect(args.where.status).toBe("processing")
    expect(args.where.updatedAt.lt).toBeInstanceOf(Date)
    expect(args.data.status).toBe("pending")

    const thresholdAgeMs = Date.now() - args.where.updatedAt.lt.getTime()
    expect(thresholdAgeMs).toBeGreaterThanOrEqual(10 * 60 * 1000 - 1000)
    expect(thresholdAgeMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000)

    expect(transactionMock).toHaveBeenCalled()
  })
})
