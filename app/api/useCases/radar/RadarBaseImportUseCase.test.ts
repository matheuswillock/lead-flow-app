import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const claimPendingJobMock = mock(async () => null as null | Record<string, unknown>)
const updateJobMock = mock(async () => ({}))
const createJobMock = mock(async () => ({ id: "job-1", importId: "imp-1" }))
const findByImportIdMock = mock(async () => null)
const findProfileDataMock = mock(async () => null)

mock.module("@/app/api/infra/data/repositories/radar/RadarImportJobRepository", () => ({
  radarImportJobRepository: {
    claimPendingJob: claimPendingJobMock,
    updateJob: updateJobMock,
    create: createJobMock,
    findByImportId: findByImportIdMock,
    findProfileData: findProfileDataMock,
  },
  RadarImportJobRepository: class {},
}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  default: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
  getImportCronPrisma: () => ({}),
}))

const downloadRadarImportPayloadMock = mock(async () =>
  JSON.stringify({
    columns: ["nome", "email"],
    rows: [],
    sourceFormat: "csv",
  })
)

mock.module("@/lib/radar/radar-import-storage", () => ({
  downloadRadarImportPayload: downloadRadarImportPayloadMock,
  uploadRadarImportPayload: mock(async () => "path"),
}))

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: mock(async () => {}),
  },
}))

mock.module("@/app/api/services/radar/RadarService", () => ({
  radarService: {
    syncProfileDataForTeam: mock(async () => ({ updated: 0 })),
  },
}))

const { RadarBaseImportUseCase } = await import("@/app/api/useCases/radar/RadarBaseImportUseCase")
const { withTransientTransactionRetry } = await import(
  "@/lib/prisma/retry-transient-transaction"
)

function p2028() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unable to start a transaction in the given time.",
    { code: "P2028", clientVersion: "test" }
  )
}

describe("RadarBaseImportUseCase.processPendingJobs", () => {
  beforeEach(() => {
    claimPendingJobMock.mockClear()
    claimPendingJobMock.mockImplementation(async () => null)
    updateJobMock.mockClear()
    downloadRadarImportPayloadMock.mockClear()
    downloadRadarImportPayloadMock.mockImplementation(async () =>
      JSON.stringify({ columns: ["nome", "email"], rows: [], sourceFormat: "csv" })
    )
  })

  it("T5: retorna sucesso quando não há jobs pendentes, sem retry desnecessário", async () => {
    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect(output.successMessages).toContain("Nenhum job pendente")
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
    expect(claimPendingJobMock).toHaveBeenCalledTimes(1)
  })

  it("T1: reexecuta claim após P2028 e processa o job", async () => {
    claimPendingJobMock.mockImplementation(async () => {
      if (claimPendingJobMock.mock.calls.length === 1) throw p2028()
      return {
        id: "job-1",
        importId: "imp-1",
        teamId: "team-1",
        requestedBy: "profile-1",
        storagePath: "path",
        fieldMapping: { name: "nome", email: "email" },
        processedRows: 0,
        createdCount: 0,
        enrichedCount: 0,
        skippedCount: 0,
        deferredCount: 0,
        skippedIssues: [],
        failedBatches: [],
      }
    })

    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(true)
    expect(claimPendingJobMock).toHaveBeenCalledTimes(2)
  })

  it("T2: esgota retries de P2028 e retorna mensagem com code", async () => {
    claimPendingJobMock.mockImplementation(async () => {
      throw p2028()
    })

    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("P2028")
    expect(output.errorMessages[0]).toContain("Unable to start a transaction")
    expect(output.errorMessages[0]).not.toBe("Erro ao processar jobs de importação")
    expect(claimPendingJobMock).toHaveBeenCalledTimes(3)
  })

  it("T3: erro não-transitório falha imediatamente sem retry", async () => {
    claimPendingJobMock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    })

    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.processPendingJobs()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("P2002")
    expect(claimPendingJobMock).toHaveBeenCalledTimes(1)
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
})

describe("RadarBaseImportUseCase.enqueueMappedImport", () => {
  it("rejeita mapeamento sem identidade", async () => {
    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.enqueueMappedImport({
      importId: "abc",
      storagePath: "radar-imports/team/abc.json",
      baseName: "Base teste",
      fieldMapping: { document: "doc" },
      sourceFormat: "csv",
      totalRows: 1,
      ctx: { profileId: "p1", teamId: "t1" } as never,
    })
    expect(output.isValid).toBe(false)
  })
})
