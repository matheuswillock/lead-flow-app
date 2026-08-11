import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { ParsedRadarImportRow } from "@/lib/radarImport/parseRadarImportBuffer"
import { RADAR_IMPORT_SOCIOS_PROFILE_DATA_KEY } from "@/lib/radarImport/radarImportFields"

const claimPendingJobMock = mock(async () => null as null | Record<string, unknown>)
const updateJobMock = mock(async () => ({}))
const createJobMock = mock(async () => ({ id: "job-1", importId: "imp-1" }))
const findByImportIdMock = mock(async () => null)
const findProfileDataMock = mock(
  async (): Promise<{
    profileData: Prisma.JsonValue | null
    gender: string | null
    genderSource: string | null
  } | null> => null
)
const resolveProfileForPhoneMock = mock(async () => ({
  profile: { id: "profile-1" },
  wasExisting: false,
}))
const resolveProfileForEmailMock = mock(async () => ({
  profile: { id: "profile-1" },
  wasExisting: false,
}))
const upsertIdentityMock = mock(async () => ({}))
const updateProfileDataMock = mock(async () => ({ count: 1 }))
const upsertSourceLinkMock = mock(async () => ({}))
const appendEventIfNewMock = mock(async () => null)
const updateProfileGenderMock = mock(async () => ({ count: 1 }))

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

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    resolveProfileForPhone: resolveProfileForPhoneMock,
    resolveProfileForEmail: resolveProfileForEmailMock,
    upsertIdentity: upsertIdentityMock,
    updateProfileData: updateProfileDataMock,
    upsertSourceLink: upsertSourceLinkMock,
    appendEventIfNew: appendEventIfNewMock,
    updateProfileGender: updateProfileGenderMock,
  },
  RadarRepository: class {},
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

describe("RadarBaseImportUseCase.processRow gender resolution", () => {
  const teamId = "team-1"
  const importJobId = "job-1"

  function buildRow(values: Record<string, string>, line = 2): ParsedRadarImportRow {
    return { line, values }
  }

  async function processRow(
    row: ParsedRadarImportRow,
    fieldMapping: Record<string, string>
  ) {
    const useCase = new RadarBaseImportUseCase() as unknown as {
      processRow: (
        teamId: string,
        importJobId: string,
        row: ParsedRadarImportRow,
        fieldMapping: Record<string, string>,
        seenKeys: Set<string>
      ) => Promise<unknown>
    }

    return useCase.processRow(teamId, importJobId, row, fieldMapping, new Set())
  }

  beforeEach(() => {
    findProfileDataMock.mockClear()
    findProfileDataMock.mockImplementation(async () => null)
    resolveProfileForPhoneMock.mockClear()
    resolveProfileForPhoneMock.mockImplementation(async () => ({
      profile: { id: "profile-1" },
      wasExisting: false,
    }))
    resolveProfileForEmailMock.mockClear()
    resolveProfileForEmailMock.mockImplementation(async () => ({
      profile: { id: "profile-1" },
      wasExisting: false,
    }))
    upsertIdentityMock.mockClear()
    updateProfileDataMock.mockClear()
    upsertSourceLinkMock.mockClear()
    appendEventIfNewMock.mockClear()
    updateProfileGenderMock.mockClear()
  })

  it("persiste gender mapped quando a coluna gênero está mapeada", async () => {
    await processRow(
      buildRow({
        nome: "Maria Silva",
        telefone: "11987654321",
        genero: "Feminino",
      }),
      { name: "nome", phone: "telefone", gender: "genero" }
    )

    expect(updateProfileGenderMock).toHaveBeenCalledWith(
      "profile-1",
      teamId,
      "female",
      "mapped"
    )
  })

  it("não infere quando socios contém nomes de gêneros diferentes", async () => {
    await processRow(
      buildRow({
        nome: "Empresa XPTO",
        telefone: "11987654321",
        socios: "João Silva e Maria Santos",
      }),
      { name: "nome", phone: "telefone", socios: "socios" }
    )

    expect(updateProfileGenderMock).not.toHaveBeenCalled()
  })

  it("persiste gender inferred quando socios tem nome único reconhecido", async () => {
    await processRow(
      buildRow({
        nome: "Empresa XPTO",
        telefone: "11987654321",
        socios: "João Silva",
      }),
      { name: "nome", phone: "telefone", socios: "socios" }
    )

    expect(updateProfileGenderMock).toHaveBeenCalledWith(
      "profile-1",
      teamId,
      "male",
      "inferred"
    )
  })

  it("não sobrescreve gender manual existente no perfil", async () => {
    findProfileDataMock.mockImplementation(async () => ({
      profileData: null,
      gender: "male",
      genderSource: "manual",
    }))

    await processRow(
      buildRow({
        nome: "Maria Silva",
        telefone: "11987654321",
        genero: "Feminino",
      }),
      { name: "nome", phone: "telefone", gender: "genero" }
    )

    expect(updateProfileGenderMock).not.toHaveBeenCalled()
  })

  it("não chama updateProfileGender quando gender e socios não estão mapeados", async () => {
    await processRow(
      buildRow({
        nome: "Maria Silva",
        telefone: "11987654321",
        segmento: "Industrial",
      }),
      { name: "nome", phone: "telefone", "new:segmento": "segmento" }
    )

    expect(updateProfileGenderMock).not.toHaveBeenCalled()
  })

  it("não duplica gender em profileData e preserva socios em base.socios", async () => {
    await processRow(
      buildRow({
        nome: "Maria Silva",
        telefone: "11987654321",
        genero: "Feminino",
        socios: "Maria Silva",
        segmento: "Industrial",
      }),
      {
        name: "nome",
        phone: "telefone",
        gender: "genero",
        socios: "socios",
        "new:segmento": "segmento",
      }
    )

    expect(updateProfileDataMock).toHaveBeenCalledTimes(1)
    const updateProfileDataCall = updateProfileDataMock.mock.calls[0] as unknown as
      | [string, string, Record<string, unknown>]
      | undefined
    expect(updateProfileDataCall?.[2]).toEqual({
      "base.segmento": "Industrial",
      [RADAR_IMPORT_SOCIOS_PROFILE_DATA_KEY]: "Maria Silva",
    })
  })
})
