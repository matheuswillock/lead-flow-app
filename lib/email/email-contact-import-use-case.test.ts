import { describe, expect, it, mock } from "bun:test"

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
  it("retorna sucesso quando não há jobs pendentes", async () => {
    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
  })
})
