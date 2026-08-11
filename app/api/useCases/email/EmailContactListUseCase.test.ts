import { describe, expect, it, mock, beforeEach, afterEach, setSystemTime } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const emailContactListFindFirstMock = mock(async () => null as Record<string, unknown> | null)
const emailContactListCreateMock = mock(async () => ({ id: "created-list" }))
const emailContactListFindManyMock = mock(async () => [] as Record<string, unknown>[])
const emailContactFindManyMock = mock(async () => [] as Record<string, unknown>[])
const emailContactCountMock = mock(async () => 0)
const emailContactGroupByMock = mock(async () => [] as Record<string, unknown>[])
const emailImportJobFindManyMock = mock(
  async (_args?: Record<string, unknown>) => [] as Record<string, unknown>[]
)
const emailContactRadarSyncOutboxGroupByMock = mock(
  async (_args?: Record<string, unknown>) =>
    [] as Array<{ emailImportJobId: string; _count: { _all: number } }>
)
const emailEventFindManyMock = mock(async () => [] as Record<string, unknown>[])
const transactionMock = mock(async (ops: Promise<unknown>[]) => Promise.all(ops))

const prismaMock = {
  emailContactList: {
    findFirst: emailContactListFindFirstMock,
    create: emailContactListCreateMock,
    findMany: emailContactListFindManyMock,
  },
  emailContact: {
    findMany: emailContactFindManyMock,
    count: emailContactCountMock,
    groupBy: emailContactGroupByMock,
  },
  emailImportJob: {
    findMany: emailImportJobFindManyMock,
  },
  emailContactRadarSyncOutbox: {
    groupBy: emailContactRadarSyncOutboxGroupByMock,
  },
  emailEvent: {
    findMany: emailEventFindManyMock,
  },
  $transaction: transactionMock,
}
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  // RadarRepository (via SyncEmailContactToRadarUseCase) imports withPrismaRetry.
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { EmailContactListUseCase } = await import(
  "@/app/api/useCases/email/EmailContactListUseCase"
)

const teamCtx: TeamAccess = {
  supabaseId: "supa-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "test@test.com",
  profileName: "Test User",
  isMaster: false,
  managerId: "manager-1",
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
}

type ListedContactList = {
  id: string
  name: string
  activeImport?: {
    importId: string
    status: string
    processedRows: number
    totalRows: number
    importedCount: number
    updatedCount: number
    skippedCount: number
    failedBatchCount: number
    completedBatches: number
    currentBatch: number
    totalBatches: number
    pendingRadarSync: number
    updatedAt: string
  } | null
}

function resetEmailContactListMocks() {
  setSystemTime(new Date("2026-08-10T10:45:00.000Z"))

  emailContactListFindFirstMock.mockClear()
  emailContactListCreateMock.mockClear()
  emailContactListFindManyMock.mockClear()
  emailContactFindManyMock.mockClear()
  emailContactCountMock.mockClear()
  emailContactGroupByMock.mockClear()
  emailImportJobFindManyMock.mockClear()
  emailContactRadarSyncOutboxGroupByMock.mockClear()
  emailEventFindManyMock.mockClear()
  transactionMock.mockClear()
  transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))

  emailContactListCreateMock.mockResolvedValue({ id: "created-list" })
  emailContactListFindManyMock.mockResolvedValue([])
  emailContactFindManyMock.mockResolvedValue([])
  emailContactCountMock.mockResolvedValue(0)
  emailContactGroupByMock.mockResolvedValue([])
  emailImportJobFindManyMock.mockResolvedValue([])
  emailContactRadarSyncOutboxGroupByMock.mockResolvedValue([])
  emailEventFindManyMock.mockResolvedValue([])
}

function mockListScaffold() {
  emailContactListFindFirstMock
    .mockResolvedValueOnce({ id: "default-list", isSystemDefault: true })
    .mockResolvedValueOnce({ id: "blocklist-1", isBlocklist: true })

  emailContactListFindManyMock.mockResolvedValue([
    {
      id: "default-list",
      name: "Todos contatos",
      description: null,
      totalContacts: 0,
      isSystemDefault: true,
      isBlocklist: false,
      managedByBackofficeUserId: null,
      radarSegmentId: null,
      radarSegment: null,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      updatedAt: new Date("2026-08-10T10:00:00.000Z"),
      creator: null,
    },
    {
      id: "blocklist-1",
      name: "Bloqueados",
      description: null,
      totalContacts: 0,
      isSystemDefault: false,
      isBlocklist: true,
      managedByBackofficeUserId: null,
      radarSegmentId: null,
      radarSegment: null,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      updatedAt: new Date("2026-08-10T10:00:00.000Z"),
      creator: null,
    },
    {
      id: "list-1",
      name: "Leads agosto",
      description: null,
      totalContacts: 0,
      isSystemDefault: false,
      isBlocklist: false,
      managedByBackofficeUserId: null,
      radarSegmentId: null,
      radarSegment: null,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      updatedAt: new Date("2026-08-10T10:00:00.000Z"),
      creator: null,
    },
  ])
}

function getListResult(
  output: Awaited<ReturnType<InstanceType<typeof EmailContactListUseCase>["list"]>>
) {
  expect(output.isValid).toBe(true)
  return output.result as ListedContactList[]
}

describe("EmailContactListUseCase.list — progresso de importação", () => {
  beforeEach(() => {
    resetEmailContactListMocks()
  })

  afterEach(() => {
    setSystemTime()
  })

  it("retorna status, contadores e Radar pendente do job ativo no activeImport", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-1",
        listId: "list-1",
        importId: "import-1",
        status: "processing",
        processedRows: 750,
        totalRows: 1250,
        importedCount: 700,
        updatedCount: 40,
        skippedCount: 10,
        failedBatches: [{ batchIndex: 1 }],
        batchSize: 500,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-10T10:05:00.000Z"),
      },
    ])
    emailContactRadarSyncOutboxGroupByMock.mockResolvedValue([
      { emailImportJobId: "job-1", _count: { _all: 12 } },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toMatchObject({
      importId: "import-1",
      status: "processing",
      processedRows: 750,
      totalRows: 1250,
      importedCount: 700,
      updatedCount: 40,
      skippedCount: 10,
      failedBatchCount: 1,
      pendingRadarSync: 12,
    })
    expect(emailImportJobFindManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: {
        teamId: "team-1",
        listId: { in: ["default-list", "blocklist-1", "list-1"] },
      },
    })
  })

  it("retorna completedBatches separado de currentBatch para evitar marcar lote futuro como concluído", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-1",
        listId: "list-1",
        importId: "import-1",
        status: "processing",
        processedRows: 500,
        totalRows: 1250,
        importedCount: 500,
        updatedCount: 0,
        skippedCount: 0,
        failedBatches: null,
        batchSize: 500,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-10T10:05:00.000Z"),
      },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toMatchObject({
      completedBatches: 1,
      currentBatch: 2,
      totalBatches: 3,
    })
  })

  it("mantém import terminal fora da janela quando ainda há Radar pendente", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-old-radar",
        listId: "list-1",
        importId: "import-old-radar",
        status: "completed",
        processedRows: 1250,
        totalRows: 1250,
        importedCount: 1000,
        updatedCount: 200,
        skippedCount: 50,
        failedBatches: null,
        batchSize: 500,
        createdAt: new Date("2026-08-10T08:00:00.000Z"),
        updatedAt: new Date("2026-08-10T08:30:00.000Z"),
      },
    ])
    emailContactRadarSyncOutboxGroupByMock.mockResolvedValue([
      { emailImportJobId: "job-old-radar", _count: { _all: 3 } },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toMatchObject({
      importId: "import-old-radar",
      status: "completed",
      pendingRadarSync: 3,
    })
  })

  it("não mantém import terminal antigo quando Radar pendente já zerou", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-old",
        listId: "list-1",
        importId: "import-old",
        status: "completed",
        processedRows: 1250,
        totalRows: 1250,
        importedCount: 1000,
        updatedCount: 200,
        skippedCount: 50,
        failedBatches: null,
        batchSize: 500,
        createdAt: new Date("2026-08-10T08:00:00.000Z"),
        updatedAt: new Date("2026-08-10T08:30:00.000Z"),
      },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toBeNull()
  })

  it("escopa status por lista/time e agrupa contagem Radar só nos jobs candidatos", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-current",
        listId: "list-1",
        importId: "import-current",
        status: "processing",
        processedRows: 500,
        totalRows: 1000,
        importedCount: 500,
        updatedCount: 0,
        skippedCount: 0,
        failedBatches: [],
        batchSize: 500,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-10T10:05:00.000Z"),
      },
    ])
    emailContactRadarSyncOutboxGroupByMock.mockResolvedValue([
      { emailImportJobId: "job-current", _count: { _all: 4 } },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport?.pendingRadarSync).toBe(4)
    expect(emailContactRadarSyncOutboxGroupByMock).toHaveBeenCalledTimes(1)
    expect(emailContactRadarSyncOutboxGroupByMock.mock.calls[0]?.[0]).toMatchObject({
      by: ["emailImportJobId"],
      where: {
        emailImportJobId: { in: ["job-current"] },
        teamId: "team-1",
        status: { in: ["pending", "processing"] },
      },
    })
  })

  it("mantém completed_with_errors recente e fora da janela com Radar pendente", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-errors",
        listId: "list-1",
        importId: "import-errors",
        status: "completed_with_errors",
        processedRows: 1250,
        totalRows: 1250,
        importedCount: 900,
        updatedCount: 100,
        skippedCount: 50,
        failedBatches: [{ batchIndex: 2 }],
        batchSize: 500,
        createdAt: new Date("2026-08-10T08:00:00.000Z"),
        updatedAt: new Date("2026-08-10T08:30:00.000Z"),
      },
    ])
    emailContactRadarSyncOutboxGroupByMock.mockResolvedValue([
      { emailImportJobId: "job-errors", _count: { _all: 5 } },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toMatchObject({
      importId: "import-errors",
      status: "completed_with_errors",
      failedBatchCount: 1,
      pendingRadarSync: 5,
      completedBatches: 3,
      totalBatches: 3,
    })
    expect(emailImportJobFindManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: {
        OR: expect.arrayContaining([
          expect.objectContaining({
            status: { in: expect.arrayContaining(["completed_with_errors"]) },
          }),
        ]),
      },
    })
  })

  it("marca completedBatches = totalBatches no terminal com último lote parcial", async () => {
    mockListScaffold()
    emailImportJobFindManyMock.mockResolvedValue([
      {
        id: "job-partial-last",
        listId: "list-1",
        importId: "import-partial-last",
        status: "completed",
        processedRows: 1250,
        totalRows: 1250,
        importedCount: 1200,
        updatedCount: 50,
        skippedCount: 0,
        failedBatches: null,
        batchSize: 500,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-10T10:40:00.000Z"),
      },
    ])

    const uc = new EmailContactListUseCase()
    const lists = getListResult(await uc.list(teamCtx))
    const list = lists.find((entry) => entry.id === "list-1")

    expect(list?.activeImport).toMatchObject({
      completedBatches: 3,
      currentBatch: 3,
      totalBatches: 3,
    })
  })
})

describe("EmailContactListUseCase.listContacts — origem do descadastro", () => {
  beforeEach(() => {
    resetEmailContactListMocks()
  })

  it("na blocklist, anexa campanha e assunto do e-mail que gerou o descadastro", async () => {
    emailContactListFindFirstMock.mockResolvedValueOnce({
      id: "blocklist-1",
      teamId: "team-1",
      isBlocklist: true,
      isArchived: false,
    })

    const contacts = [
      {
        id: "c1",
        email: "maria@exemplo.com",
        name: "Maria",
        isUnsubscribed: true,
        isBounced: false,
        isComplained: false,
        createdAt: new Date("2026-07-21T18:00:00.000Z"),
      },
    ]
    emailContactFindManyMock.mockResolvedValueOnce(contacts)
    emailContactCountMock.mockResolvedValueOnce(1)

    emailEventFindManyMock.mockResolvedValueOnce([
      {
        occurredAt: new Date("2026-07-21T17:50:00.000Z"),
        log: {
          recipientEmail: "maria@exemplo.com",
          subject: "Uma ideia para otimizar sua corretora",
          campaignId: "camp-1",
          campaign: { id: "camp-1", name: "LEADS PME CORRETOR" },
        },
      },
    ])

    const uc = new EmailContactListUseCase()
    const output = await uc.listContacts("blocklist-1", teamCtx, {
      page: 1,
      pageSize: 20,
    })

    expect(output.isValid).toBe(true)
    expect(emailEventFindManyMock).toHaveBeenCalled()
    const result = output.result as {
      contacts: Array<{
        email: string
        unsubscribeSource: {
          campaignId: string | null
          campaignName: string | null
          subject: string | null
          unsubscribedAt: string
        } | null
      }>
    }
    expect(result.contacts[0]?.unsubscribeSource).toEqual({
      campaignId: "camp-1",
      campaignName: "LEADS PME CORRETOR",
      subject: "Uma ideia para otimizar sua corretora",
      unsubscribedAt: "2026-07-21T17:50:00.000Z",
    })
  })

  it("em lista normal, não busca eventos de descadastro e deixa unsubscribeSource null", async () => {
    emailContactListFindFirstMock.mockResolvedValueOnce({
      id: "list-1",
      teamId: "team-1",
      isBlocklist: false,
      isArchived: false,
    })

    emailContactFindManyMock.mockResolvedValueOnce([
      {
        id: "c1",
        email: "ok@exemplo.com",
        name: "Ok",
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
      },
    ])
    emailContactCountMock.mockResolvedValueOnce(1)

    const uc = new EmailContactListUseCase()
    const output = await uc.listContacts("list-1", teamCtx, {
      page: 1,
      pageSize: 20,
    })

    expect(output.isValid).toBe(true)
    expect(emailEventFindManyMock).not.toHaveBeenCalled()
    const result = output.result as {
      contacts: Array<{ unsubscribeSource: unknown }>
    }
    expect(result.contacts[0]?.unsubscribeSource).toBeNull()
  })
})
