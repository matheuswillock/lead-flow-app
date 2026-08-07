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

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaStub,
  getImportCronPrisma: () => prismaStub,
}))

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: mock(async () => {}),
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

  it("avança processedRows só após sync Radar do lote (I3)", async () => {
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
      // upsertContactsBatch: select email; radar sync: select id
      if (args?.select?.id) {
        return contactIds.map(({ id }) => ({ id }))
      }
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 3 }))

    const processedRowsSnapshots: number[] = []
    syncExecuteMock.mockImplementation(async () => {
      const calls = jobUpdateMock.mock.calls as unknown as Array<
        [{ data?: { processedRows?: number } }]
      >
      const lastUpdate = calls.at(-1)
      // Durante sync, processedRows ainda não deve ter avançado neste lote
      processedRowsSnapshots.push(
        lastUpdate?.[0]?.data?.processedRows ?? claimedJob!.processedRows
      )
      return {
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: { errors: 0 },
      }
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(syncExecuteMock).toHaveBeenCalledTimes(3)
    // Durante todo o sync, checkpoint do lote ainda em 0
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

  it("sincroniza Radar em chunks de 5 via Promise.all (I2)", async () => {
    const rows = makeRows(12)
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => true)

    const contactIds = rows.map((_, i) => ({ id: `contact-${i + 1}` }))
    emailContactFindManyMock.mockImplementation(async (args) => {
      if (args?.select?.id) return contactIds
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 12 }))

    let inFlight = 0
    let maxInFlight = 0
    syncExecuteMock.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight -= 1
      return {
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: { errors: 0 },
      }
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(syncExecuteMock).toHaveBeenCalledTimes(12)
    expect(maxInFlight).toBe(5)
  })

  it("em timeout mid-sync não avança processedRows do lote incompleto (I2+I3)", async () => {
    const rows = makeRows(8)
    claimedJob = makeJob({ processedRows: 0 })
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows }))
    teamHasRadarFeatureMock.mockImplementation(async () => true)

    const contactIds = rows.map((_, i) => ({ id: `contact-${i + 1}` }))
    emailContactFindManyMock.mockImplementation(async (args) => {
      if (args?.select?.id) return contactIds
      return []
    })
    emailContactCreateManyMock.mockImplementation(async () => ({ count: 8 }))

    const realNow = Date.now
    let fakeNow = realNow()
    Date.now = () => fakeNow

    let syncCalls = 0
    syncExecuteMock.mockImplementation(async () => {
      syncCalls += 1
      // Após o 1º chunk (5 contatos), estoura o budget no check do próximo chunk
      if (syncCalls >= 5) {
        fakeNow += 50_000
      }
      return {
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: { errors: 0 },
      }
    })

    try {
      const useCase = new EmailContactImportUseCase()
      const output = await useCase.processPendingJobs()

      expect(output.isValid).toBe(true)
      expect(output.successMessages).toContain("Job re-enfileirado por tempo")
      expect(syncCalls).toBe(5)

      const requeueUpdate = (
        jobUpdateMock.mock.calls as unknown as Array<
          [{ data: { status?: string; processedRows?: number } }]
        >
      )
        .map((call) => call[0].data)
        .find((d) => d.status === "pending")

      expect(requeueUpdate).toBeDefined()
      expect(requeueUpdate?.processedRows).toBe(0)
    } finally {
      Date.now = realNow
    }
  })

  it("sem feature Radar avança processedRows após upsert (skip sync)", async () => {
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

    const checkpoint = (
      jobUpdateMock.mock.calls as unknown as Array<[{ data: { processedRows?: number } }]>
    )
      .map((call) => call[0].data)
      .find((d) => d.processedRows === 2)
    expect(checkpoint?.processedRows).toBe(2)
  })
})
