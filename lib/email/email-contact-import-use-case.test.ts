import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import { AUDIENCE_REASON_BLOCKLISTED } from "@/lib/email/audience-prevalidation"

const updateManyMock = mock(async () => ({ count: 0 }))
const jobUpdateMock = mock(async () => ({}))
const emailContactFindManyMock = mock(
  async (_args?: {
    select?: { id?: boolean; email?: boolean }
    where?: { list?: { isBlocklist?: boolean } }
  }) => [] as { id?: string; email?: string }[]
)
const emailContactCreateManyMock = mock(async () => ({ count: 0 }))
const emailContactUpdateMock = mock(async () => ({}))
const emailContactCountMock = mock(async () => 0)
const emailContactListFindFirstMock = mock(async () => null as null | {
  id: string
  isSystemDefault: boolean
  isBlocklist?: boolean
})
const emailContactDeleteManyMock = mock(async () => ({ count: 0 }))
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
    deleteMany: emailContactDeleteManyMock,
    upsert: mock(async () => ({})),
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
  default: {
    ...prismaStub,
    emailContactRadarSyncOutbox: {
      upsert: upsertMock,
      count: countMock,
    },
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
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
const { withTransientTransactionRetry } = await import(
  "@/lib/prisma/retry-transient-transaction"
)

function p2028() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unable to start a transaction in the given time.",
    { code: "P2028", clientVersion: "test" }
  )
}

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
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        emailImportJob: {
          findFirst: mock(async () => claimedJob),
          updateMany: mock(async () => ({ count: claimedJob ? 1 : 0 })),
        },
        emailContact: prismaStub.emailContact,
        emailContactList: prismaStub.emailContactList,
      }
      return fn(tx)
    })
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
    emailContactDeleteManyMock.mockClear()
    emailContactDeleteManyMock.mockImplementation(async () => ({ count: 0 }))
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

  it("não importa e-mail bloqueado no time, nem na lista alvo nem no fan-out padrão", async () => {
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      // Lista comum: força o fan-out para a lista padrão (o segundo destino de escrita).
      isSystemDefault: false,
    }))
    downloadPayloadMock.mockImplementation(async () =>
      JSON.stringify({
        rows: [
          { email: "bloqueado@example.com", name: "Bloqueado" },
          { email: "livre@example.com", name: "Livre" },
        ],
      })
    )
    emailContactFindManyMock.mockImplementation(async (args) => {
      // Caixa alta de propósito: a blocklist compara normalizada.
      if (args?.where?.list?.isBlocklist) return [{ email: "Bloqueado@Example.com" }]
      return []
    })

    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()

    const createManyArgs = emailContactCreateManyMock.mock.calls as unknown as Array<
      [{ data?: { email: string }[] } | undefined]
    >
    const importedEmails = createManyArgs.flatMap(([args]) =>
      (args?.data ?? []).map((row) => row.email)
    )
    expect(importedEmails).toContain("livre@example.com")
    expect(importedEmails).not.toContain("bloqueado@example.com")

    // A gravação de progresso carrega skippedCount; finalizeJob roda depois só com o status.
    const jobUpdateArgs = jobUpdateMock.mock.calls as unknown as Array<
      [{ data?: { skippedCount?: number; skippedIssues?: unknown } } | undefined]
    >
    const progressUpdate = jobUpdateArgs
      .map(([args]) => args)
      .findLast((args) => args?.data?.skippedCount !== undefined)
    expect(progressUpdate?.data?.skippedCount).toBe(1)
    expect(progressUpdate?.data?.skippedIssues).toEqual([
      { email: "bloqueado@example.com", reason: AUDIENCE_REASON_BLOCKLISTED },
    ])
  })

  it("import para a blocklist grava o checkpoint de progresso a cada lote", async () => {
    // Regressão: a branch de blocklist usava `continue`, que pula o
    // `emailImportJob.update` do fim do laço. O job terminava com processedRows
    // parado em 0 e, se o cron fosse interrompido, reprocessava tudo de novo.
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: false,
      isBlocklist: true,
    }))
    downloadPayloadMock.mockImplementation(async () =>
      JSON.stringify({
        rows: [
          { email: "a@example.com", name: "A" },
          { email: "b@example.com", name: "B" },
        ],
      })
    )

    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()

    const jobUpdateArgs = jobUpdateMock.mock.calls as unknown as Array<
      [{ data?: { processedRows?: number; importedCount?: number } } | undefined]
    >
    const progressUpdate = jobUpdateArgs
      .map(([args]) => args)
      .findLast((args) => args?.data?.processedRows !== undefined)

    expect(progressUpdate?.data?.processedRows).toBe(2)
    expect(progressUpdate?.data?.importedCount).toBe(2)
  })

  it("import para a blocklist não abre uma transação por endereço", async () => {
    // Regressão: 500 linhas × 9 queries em 500 transações seriais estouravam o
    // maxDuration=60s do cron antes de qualquer checkpoint.
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: false,
      isBlocklist: true,
    }))
    downloadPayloadMock.mockImplementation(async () =>
      JSON.stringify({
        rows: Array.from({ length: 50 }, (_, i) => ({
          email: `user${i}@example.com`,
          name: `User ${i}`,
        })),
      })
    )

    const transactionsBefore = transactionMock.mock.calls.length
    const useCase = new EmailContactImportUseCase()
    await useCase.processPendingJobs()
    const transactionsForBatch = transactionMock.mock.calls.length - transactionsBefore

    // 1 do claim + 1 do lote inteiro. Nunca proporcional ao número de linhas.
    expect(transactionsForBatch).toBeLessThanOrEqual(3)
    expect(emailContactDeleteManyMock.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it("T5: retorna sucesso quando não há jobs pendentes, sem retry desnecessário", async () => {
    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect(output.successMessages).toContain("Nenhum job pendente")
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it("T1: reexecuta claim após P2028 e processa o job", async () => {
    claimedJob = makeJob()
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: true,
    }))
    downloadPayloadMock.mockImplementation(async () => JSON.stringify({ rows: [] }))

    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      if (transactionMock.mock.calls.length === 1) throw p2028()
      const tx = {
        emailImportJob: {
          findFirst: mock(async () => claimedJob),
          updateMany: mock(async () => ({ count: 1 })),
        },
      }
      return fn(tx)
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(transactionMock).toHaveBeenCalledTimes(2)
  })

  it("T2: esgota retries de P2028 e retorna mensagem com code", async () => {
    transactionMock.mockImplementation(async () => {
      throw p2028()
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("P2028")
    expect(output.errorMessages[0]).toContain("Unable to start a transaction")
    expect(output.errorMessages[0]).not.toBe("Erro ao processar jobs de importação")
    expect(transactionMock).toHaveBeenCalledTimes(3)
  })

  it("T3: erro não-transitório falha imediatamente sem retry", async () => {
    transactionMock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    })

    const useCase = new EmailContactImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("P2002")
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it("T4: retry usa o backoff default de produção entre tentativas", async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    const operation = mock(async () => {
      throw p2028()
    })

    await expect(
      withTransientTransactionRetry(operation, {
        maxAttempts: 3,
        sleep,
      })
    ).rejects.toMatchObject({ code: "P2028" })

    expect(delays).toEqual([250, 500])
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
