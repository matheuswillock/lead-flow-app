import { describe, expect, it, mock, beforeEach } from "bun:test"

const teamHasRadarFeatureMock = mock(async () => false)

const emailImportJobUpdateManyMock = mock(async () => ({ count: 0 }))
const emailImportJobUpdateMock = mock(async () => ({}))
const emailImportJobFindFirstMock = mock(async (): Promise<null | Record<string, unknown>> => null)

const transactionMock = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    emailImportJob: {
      findFirst: emailImportJobFindFirstMock,
      updateMany: mock(async () => ({ count: 0 })),
    },
  }
  return fn(tx)
})

const emailContactFindManyMock = mock(async (): Promise<Array<{ id: string }>> => [])
const emailContactCreateManyMock = mock(async () => ({ count: 0 }))
const emailContactUpdateMock = mock(async () => ({}))

const syncExecuteMock = mock(async () => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { errors: 0 },
}))

const prismaMock = {
  $transaction: transactionMock,
  emailImportJob: {
    updateMany: emailImportJobUpdateManyMock,
    update: emailImportJobUpdateMock,
    findFirst: emailImportJobFindFirstMock,
  },
  emailContact: {
    findMany: emailContactFindManyMock,
    createMany: emailContactCreateManyMock,
    update: emailContactUpdateMock,
    count: mock(async () => 3),
  },
  emailContactList: {
    findFirst: mock(async () => ({
      id: "list-1",
      isSystemDefault: true,
    })),
    update: mock(async () => ({})),
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  getImportCronPrisma: () => prismaMock,
}))

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: mock(async () => {}),
  },
}))

mock.module("@/lib/email/email-import-storage", () => ({
  downloadEmailImportPayload: mock(async () =>
    JSON.stringify({
      rows: Array.from({ length: 3 }, (_, index) => ({
        line: index + 1,
        email: `user${index + 1}@example.com`,
        name: `User ${index + 1}`,
      })),
    })
  ),
  uploadEmailImportPayload: mock(async () => "path"),
}))

mock.module("@/lib/radar/team-has-radar-feature", () => ({
  teamHasRadarFeature: teamHasRadarFeatureMock,
}))

mock.module("@/app/api/useCases/radar/SyncEmailContactToRadarUseCase", () => ({
  syncEmailContactToRadarUseCase: {
    execute: syncExecuteMock,
  },
}))

const { EmailContactImportUseCase } = await import(
  "@/app/api/useCases/email/EmailContactImportUseCase"
)

describe("EmailContactImportUseCase.processPendingJobs", () => {
  beforeEach(() => {
    emailImportJobUpdateManyMock.mockClear()
    emailImportJobUpdateMock.mockClear()
    emailImportJobFindFirstMock.mockClear()
    transactionMock.mockClear()
    emailContactFindManyMock.mockClear()
    syncExecuteMock.mockClear()
    teamHasRadarFeatureMock.mockClear()
    teamHasRadarFeatureMock.mockImplementation(async () => false)
    emailImportJobUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailImportJobFindFirstMock.mockImplementation(async () => null)
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        emailImportJob: {
          findFirst: emailImportJobFindFirstMock,
          updateMany: mock(async () => ({ count: 1 })),
        },
      }
      return fn(tx)
    })
  })

  it("retorna sucesso quando não há jobs pendentes", async () => {
    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
  })

  it("reclaimStuckJobs devolve jobs processing antigos a pending antes do claim", async () => {
    emailImportJobUpdateManyMock.mockImplementation(async (...args: unknown[]) => {
      const args0 = args[0] as {
        where?: { status?: string; updatedAt?: { lt?: Date } }
        data?: { status?: string }
      }
      expect(args0.where?.status).toBe("processing")
      expect(args0.data?.status).toBe("pending")
      return { count: 2 }
    })

    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()

    expect(emailImportJobUpdateManyMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    const firstCall = (emailImportJobUpdateManyMock.mock.calls[0] as unknown[] | undefined)?.[0] as
      | { data?: { status?: string } }
      | undefined
    expect(firstCall?.data?.status).toBe("pending")
  })

  it("incrementa processedRows após sync Radar completo do lote", async () => {
    const claimedJob = {
      id: "job-1",
      importId: "import-abc",
      teamId: "team-1",
      listId: "list-1",
      requestedBy: "profile-1",
      sourceFormat: "json",
      storagePath: "path",
      processedRows: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      skippedIssues: null,
      failedBatches: null,
      attemptsByBatch: null,
      batchSize: 500,
    }

    emailImportJobFindFirstMock.mockImplementation(async () => claimedJob)
    emailContactFindManyMock.mockImplementation(async () => [
      { id: "contact-1" },
      { id: "contact-2" },
      { id: "contact-3" },
    ])

    teamHasRadarFeatureMock.mockImplementation(async () => true)

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(syncExecuteMock.mock.calls.length).toBe(3)

    const progressUpdates = emailImportJobUpdateMock.mock.calls.filter((call) => {
      const args = (call as unknown[])[0] as { data?: { processedRows?: number } }
      return args.data?.processedRows === 3
    })
    expect(progressUpdates.length).toBeGreaterThan(0)
  })

  it("não incrementa processedRows quando sync Radar expira no meio do lote", async () => {
    const claimedJob = {
      id: "job-1",
      importId: "import-abc",
      teamId: "team-1",
      listId: "list-1",
      requestedBy: "profile-1",
      sourceFormat: "json",
      storagePath: "path",
      processedRows: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      skippedIssues: null,
      failedBatches: null,
      attemptsByBatch: null,
      batchSize: 500,
    }

    emailImportJobFindFirstMock.mockImplementation(async () => claimedJob)
    emailContactFindManyMock.mockImplementation(async () => [
      { id: "contact-1" },
      { id: "contact-2" },
      { id: "contact-3" },
      { id: "contact-4" },
      { id: "contact-5" },
      { id: "contact-6" },
    ])

    teamHasRadarFeatureMock.mockImplementation(async () => true)

    let fakeTime = 0
    const originalDateNow = Date.now
    Date.now = () => fakeTime

    syncExecuteMock.mockImplementation(async () => {
      fakeTime = 50_000
      return {
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: { errors: 0 },
      }
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    Date.now = originalDateNow

    expect(output.isValid).toBe(true)
    expect((output.result as { resumedAtBatch?: number }).resumedAtBatch).toBe(1)

    const timeoutUpdate = emailImportJobUpdateMock.mock.calls.find((call) => {
      const args = (call as unknown[])[0] as {
        data?: { status?: string; processedRows?: number }
      }
      return args.data?.status === "pending"
    })
    expect(timeoutUpdate).toBeDefined()
    const timeoutArgs = (timeoutUpdate as unknown[])[0] as {
      data?: { processedRows?: number }
    }
    expect(timeoutArgs.data?.processedRows).toBe(0)
  })
})
