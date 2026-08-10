import { beforeEach, describe, expect, it, mock } from "bun:test"

const updateManyMock = mock(async () => ({ count: 0 }))
const jobUpdateMock = mock(async () => ({}))
const emailContactFindManyMock = mock(
  async (_args?: { select?: { id?: boolean; email?: boolean } }) =>
    [] as { id?: string; email?: string }[]
)
const emailContactCreateManyMock = mock(async () => ({ count: 0 }))
const emailContactUpdateMock = mock(async () => ({}))
const emailContactCountMock = mock(async () => 0)
const emailContactListFindFirstMock = mock(async () => null as null | {
  id: string
  isSystemDefault: boolean
})
const emailContactListUpdateMock = mock(async () => ({}))

const syncExecuteMock = mock(async () => ({
  isValid: true,
  successMessages: [] as string[],
  errorMessages: [] as string[],
  result: { errors: 0 },
}))

const teamHasRadarFeatureMock = mock(async () => false)

const downloadPayloadMock = mock(async () =>
  JSON.stringify({
    rows: [] as { email: string; name?: string }[],
  })
)

let claimedJob: {
  id: string
  importId: string
  teamId: string
  listId: string
  requestedBy: string
  sourceFormat: string
  storagePath: string
  processedRows: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  skippedIssues: unknown
  failedBatches: unknown
  attemptsByBatch: unknown
  status: string
} | null = null

const transactionMock = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    emailImportJob: {
      findFirst: mock(async () => claimedJob),
      updateMany: mock(async () => ({ count: claimedJob ? 1 : 0 })),
    },
  }
  return fn(tx)
})

const prismaStub = {
  $transaction: transactionMock,
  emailImportJob: {
    update: jobUpdateMock,
    updateMany: updateManyMock,
  },
  emailContactList: {
    findFirst: emailContactListFindFirstMock,
    update: emailContactListUpdateMock,
    create: mock(async () => ({ id: "default-list" })),
  },
  emailContact: {
    findMany: emailContactFindManyMock,
    createMany: emailContactCreateManyMock,
    update: emailContactUpdateMock,
    count: emailContactCountMock,
  },
}

const upsertMock = mock(async (_args?: unknown) => ({}))
const countMock = mock(async () => 0)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    ...prismaStub,
    emailContactRadarSyncOutbox: {
      upsert: upsertMock,
      count: countMock,
    },
  },
  getImportCronPrisma: () => ({
    ...prismaStub,
    emailContactRadarSyncOutbox: {
      upsert: upsertMock,
      count: countMock,
    },
  }),
}))

const createSystemNotificationMock = mock(async (_args?: unknown) => {})

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: createSystemNotificationMock,
  },
}))

mock.module("@/lib/email/email-import-storage", () => ({
  downloadEmailImportPayload: downloadPayloadMock,
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

function makeJob(overrides: Partial<typeof claimedJob> = {}) {
  return {
    id: "job-1",
    importId: "imp-1",
    teamId: "team-1",
    listId: "list-1",
    requestedBy: "profile-1",
    sourceFormat: "json",
    storagePath: "storage/path",
    processedRows: 0,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    skippedIssues: [],
    failedBatches: [],
    attemptsByBatch: {},
    status: "pending",
    ...overrides,
  }
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
  }))
}

describe("EmailContactImportUseCase.processPendingJobs", () => {
  beforeEach(() => {
    claimedJob = null
    updateManyMock.mockClear()
    updateManyMock.mockImplementation(async () => ({ count: 0 }))
    transactionMock.mockClear()
    jobUpdateMock.mockClear()
    jobUpdateMock.mockImplementation(async () => ({}))
    emailContactFindManyMock.mockClear()
    emailContactFindManyMock.mockImplementation(async (_args?) => [])
    emailContactCreateManyMock.mockClear()
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailContactUpdateMock.mockClear()
    emailContactCountMock.mockClear()
    emailContactCountMock.mockImplementation(async () => 0)
    emailContactListFindFirstMock.mockClear()
    emailContactListFindFirstMock.mockImplementation(async () => null)
    emailContactListUpdateMock.mockClear()
    syncExecuteMock.mockClear()
    syncExecuteMock.mockImplementation(async () => ({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { errors: 0 },
    }))
    teamHasRadarFeatureMock.mockClear()
    teamHasRadarFeatureMock.mockImplementation(async () => false)
    upsertMock.mockClear()
    countMock.mockClear()
    countMock.mockImplementation(async () => 0)
    createSystemNotificationMock.mockClear()
    downloadPayloadMock.mockClear()
    downloadPayloadMock.mockImplementation(async () =>
      JSON.stringify({ rows: [] })
    )
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

  it("com Radar habilitado enfileira outbox e não chama sync síncrono (D9)", async () => {
    const rows = makeRows(3)
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => true)

    const contactIds = rows.map((_, i) => ({ id: `contact-${i + 1}`, email: rows[i].email }))
    emailContactFindManyMock.mockImplementation(async (args) => {
      if (args?.select?.id) {
        return contactIds.map(({ id }) => ({ id }))
      }
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 3 }))

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(syncExecuteMock).not.toHaveBeenCalled()
    expect(upsertMock).toHaveBeenCalledTimes(3)
    const upsertCall = upsertMock.mock.calls[0]?.[0] as {
      create: { emailImportJobId: string; teamId: string };
    } | undefined
    expect(upsertCall?.create.emailImportJobId).toBe("job-1")
    expect(upsertCall?.create.teamId).toBe("team-1")
  })

  it("avança processedRows logo após upsert de contatos, sem esperar Radar (D9)", async () => {
    const rows = makeRows(3)
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => true)

    const contactIds = rows.map((_, i) => ({ id: `contact-${i + 1}`, email: rows[i].email }))
    emailContactFindManyMock.mockImplementation(async (args) => {
      if (args?.select?.id) {
        return contactIds.map(({ id }) => ({ id }))
      }
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 3 }))

    const processedRowsSnapshots: number[] = []
    upsertMock.mockImplementation(async () => {
      const calls = jobUpdateMock.mock.calls as unknown as Array<
        [{ data?: { processedRows?: number } }]
      >
      const lastUpdate = calls.at(-1)
      processedRowsSnapshots.push(
        lastUpdate?.[0]?.data?.processedRows ?? claimedJob!.processedRows
      )
      return {}
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(processedRowsSnapshots.every((v) => v === 0)).toBe(true)

    const finalUpdates = (
      jobUpdateMock.mock.calls as unknown as Array<
        [{ data: { processedRows?: number; status?: string } }]
      >
    ).map((call) => call[0].data)
    const completedCheckpoint = finalUpdates.find(
      (d) => d.processedRows === 3 && d.status !== "pending"
    )
    expect(completedCheckpoint?.processedRows).toBe(3)
  })

  it("notificação de import inclui pendingRadarSync escopado ao job atual", async () => {
    const rows = makeRows(2)
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => true)
    countMock.mockImplementation(async (args?: { where?: { emailImportJobId?: string } }) =>
      args?.where?.emailImportJobId === "job-1" ? 2 : 99
    )

    emailContactFindManyMock.mockImplementation(async (args) => {
      if (args?.select?.id) {
        return [{ id: "contact-1" }, { id: "contact-2" }]
      }
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 2 }))

    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()

    expect(createSystemNotificationMock).toHaveBeenCalled()
    const notifyCall = createSystemNotificationMock.mock.calls[0]?.[0] as {
      metadata?: { pendingRadarSync?: number }
    } | undefined
    expect(notifyCall?.metadata?.pendingRadarSync).toBe(2)
  })

  it("sem feature Radar avança processedRows após upsert (skip outbox)", async () => {
    const rows = makeRows(2)
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => false)
    emailContactFindManyMock.mockImplementation(async () => [])
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 2 }))

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(syncExecuteMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()

    const checkpoint = (
      jobUpdateMock.mock.calls as unknown as Array<[{ data: { processedRows?: number } }]>
    )
      .map((call) => call[0].data)
      .find((d) => d.processedRows === 2)
    expect(checkpoint?.processedRows).toBe(2)
  })
})
