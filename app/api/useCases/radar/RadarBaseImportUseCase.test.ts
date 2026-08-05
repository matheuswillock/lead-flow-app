import { describe, expect, it, mock } from "bun:test"

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    radarImportJob: {
      findFirst: mock(async () => null),
    },
    $transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        radarImportJob: {
          findFirst: mock(async () => null),
          updateMany: mock(async () => ({ count: 0 })),
        },
      }
      return fn(tx)
    }),
  },
}))

mock.module("@/lib/radar/radar-import-storage", () => ({
  downloadRadarImportPayload: mock(async () =>
    JSON.stringify({
      columns: ["nome", "email"],
      rows: [{ line: 1, values: { nome: "Maria", email: "maria@example.com" } }],
      sourceFormat: "csv",
    })
  ),
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

describe("RadarBaseImportUseCase.processPendingJobs", () => {
  it("retorna sucesso quando não há jobs pendentes", async () => {
    const useCase = new RadarBaseImportUseCase()
    const output = await useCase.processPendingJobs()
    expect(output.isValid).toBe(true)
    expect((output.result as { processedJobs: number }).processedJobs).toBe(0)
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
