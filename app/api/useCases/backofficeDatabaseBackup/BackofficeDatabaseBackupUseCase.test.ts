import { describe, expect, it, mock } from "bun:test"
import { Readable } from "node:stream"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import type {
  IBackofficeDatabaseBackupExportService,
  BackupArchive,
} from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupExportService"
import type { IBackofficeDatabaseBackupGoogleDriveService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupGoogleDriveService"
import { BackofficeDatabaseBackupUseCase } from "./BackofficeDatabaseBackupUseCase"

function createRepoMock(
  overrides: Partial<IBackofficeDatabaseBackupRepository> = {}
): IBackofficeDatabaseBackupRepository {
  return {
    claimPendingSlot: async () => ({ ok: true, id: "backup-1" }),
    update: async () => undefined,
    list: async () => [],
    findById: async () => null,
    ...overrides,
  }
}

function createArchiveStub(
  overrides: Partial<BackupArchive> = {}
): BackupArchive {
  const body = Readable.from([Buffer.from("zip-content")])
  return {
    fileName: "backup-2026-07-31-10-00.zip",
    body,
    completion: Promise.resolve({
      sizeBytes: 1024,
      checksumSha256: "abc123",
      modelCount: 3,
      rowCount: 42,
    }),
    abort: () => {},
    ...overrides,
  }
}

function createExportMock(
  overrides: Partial<IBackofficeDatabaseBackupExportService> = {}
): IBackofficeDatabaseBackupExportService {
  return {
    createArchive: () => createArchiveStub(),
    ...overrides,
  }
}

function createDriveMock(
  overrides: Partial<IBackofficeDatabaseBackupGoogleDriveService> = {}
): IBackofficeDatabaseBackupGoogleDriveService {
  return {
    upload: async () => ({ fileId: "drive-file-id-1" }),
    downloadStream: async () => new ReadableStream(),
    ...overrides,
  }
}

const baseRecord = {
  id: "b1",
  startedAt: new Date("2026-07-31T10:00:00.000Z"),
  finishedAt: new Date("2026-07-31T10:05:00.000Z"),
  status: "success" as const,
  source: "cron" as const,
  triggeredByProfileId: null,
  filePath: null,
  fileName: "backup-2026-07-31-10-00.zip",
  sizeBytes: BigInt(1024),
  checksumSha256: "abc123",
  storageSyncPath: null,
  errorMessage: null,
  googleDriveFileId: "drive-file-id-1",
  googleDriveDownloadUrl: null,
  createdAt: new Date("2026-07-31T10:00:00.000Z"),
}

describe("BackofficeDatabaseBackupUseCase", () => {
  describe("list", () => {
    it("serializa sizeBytes bigint para number e inclui source", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          list: async () => [{ ...baseRecord, sizeBytes: BigInt(2048) }],
        }),
        createExportMock(),
        createDriveMock()
      )

      const output = await useCase.list()
      expect(output.isValid).toBe(true)
      const items = (
        output.result as {
          items: Array<{ sizeBytes: number | null; source: string }>
        }
      ).items
      expect(items[0]?.sizeBytes).toBe(2048)
      expect(items[0]?.source).toBe("cron")
    })
  })

  describe("triggerCronBackup", () => {
    it("cria pending com source=cron e marca success com fileId do Drive", async () => {
      const claimCalls: Array<{ source: string; triggeredByProfileId?: string | null }> = []
      const lastUpdate: {
        status?: string
        fileName?: string | null
        checksumSha256?: string | null
        sizeBytes?: bigint | null
        googleDriveFileId?: string | null
      }[] = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          claimPendingSlot: async (input) => {
            claimCalls.push(input)
            return { ok: true, id: "backup-1" }
          },
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock(),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(true)
      expect((output.result as { id: string }).id).toBe("backup-1")
      expect(claimCalls[0]).toEqual({ source: "cron", triggeredByProfileId: null })
      expect(lastUpdate[0]?.status).toBe("success")
      expect(lastUpdate[0]?.fileName).toBe("backup-2026-07-31-10-00.zip")
      expect(lastUpdate[0]?.checksumSha256).toBe("abc123")
      expect(lastUpdate[0]?.sizeBytes).toEqual(BigInt(1024))
      expect(lastUpdate[0]?.googleDriveFileId).toBe("drive-file-id-1")
    })

    it("bloqueia quando o slot pending já está ocupado", async () => {
      const claimPendingSlot = mock(async () => ({
        ok: false as const,
        reason: "busy" as const,
      }))
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({ claimPendingSlot }),
        createExportMock(),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("em andamento")
      expect(claimPendingSlot).toHaveBeenCalled()
    })

    it("marca failed e leva a causa real do export para a mensagem do cron", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock({
          createArchive: () =>
            createArchiveStub({
              completion: Promise.reject(new Error("Invalid string length")),
            }),
        }),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      // withCronAudit deriva o errorSummary de errorMessages.join("; ").
      expect(output.errorMessages[0]).toBe(
        "Erro ao gerar backup: Invalid string length"
      )
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("Invalid string length")
    })

    it("prefere a causa do export quando o upload falha por efeito colateral", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const aborted: Error[] = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock({
          createArchive: () =>
            createArchiveStub({
              completion: Promise.reject(
                new Error("Transaction already closed: timeout")
              ),
              abort: (error) => {
                aborted.push(error)
              },
            }),
        }),
        createDriveMock({
          upload: async () => {
            throw new Error("socket hang up")
          },
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe(
        "Erro ao gerar backup: Transaction already closed: timeout"
      )
      expect(lastUpdate[0]?.errorMessage).toBe(
        "Transaction already closed: timeout"
      )
      expect(aborted[0]?.message).toBe("socket hang up")
    })

    it("marca failed e aborta o arquivo quando só o upload falha", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const aborted: Error[] = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock({
          createArchive: () =>
            createArchiveStub({
              abort: (error) => {
                aborted.push(error)
              },
            }),
        }),
        createDriveMock({
          upload: async () => {
            throw new Error("Upload falhou")
          },
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Erro ao gerar backup: Upload falhou")
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("Upload falhou")
      expect(aborted[0]?.message).toBe("Upload falhou")
    })

    it("achata mensagem multi-linha do Prisma em uma unica linha", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock(),
        createExportMock({
          createArchive: () =>
            createArchiveStub({
              completion: Promise.reject(
                new Error(
                  "\n   Transaction already closed: the timeout was 120000 ms\n   at runInTransaction"
                )
              ),
            }),
        }),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.errorMessages[0]).toBe(
        "Erro ao gerar backup: Transaction already closed: the timeout was 120000 ms"
      )
      expect(output.errorMessages[0]).not.toContain("\n")
    })

    it("trunca causa muito longa para caber no errorSummary do cron", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock(),
        createExportMock({
          createArchive: () =>
            createArchiveStub({
              completion: Promise.reject(new Error("z".repeat(1000))),
            }),
        }),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      const summary = output.errorMessages[0]!
      expect(summary.length).toBeLessThan(300)
      expect(summary.endsWith("...")).toBe(true)
    })
  })

  describe("triggerManualBackup", () => {
    it("cria pending com source=manual e triggeredByProfileId", async () => {
      const claimCalls: Array<{ source: string; triggeredByProfileId?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          claimPendingSlot: async (input) => {
            claimCalls.push(input)
            return { ok: true, id: "backup-manual-1" }
          },
        }),
        createExportMock(),
        createDriveMock()
      )

      const output = await useCase.triggerManualBackup("profile-manager-1")
      expect(output.isValid).toBe(true)
      expect((output.result as { id: string }).id).toBe("backup-manual-1")
      expect(claimCalls[0]).toEqual({
        source: "manual",
        triggeredByProfileId: "profile-manager-1",
      })
    })

    it("bloqueia quando o slot pending já está ocupado", async () => {
      const claimPendingSlot = mock(async () => ({
        ok: false as const,
        reason: "busy" as const,
      }))
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({ claimPendingSlot }),
        createExportMock(),
        createDriveMock()
      )

      const output = await useCase.triggerManualBackup("profile-manager-1")
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("em andamento")
      expect(claimPendingSlot).toHaveBeenCalled()
    })
  })

  describe("getDownloadStream", () => {
    it("retorna 404 quando backup não existe", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock(),
        createExportMock(),
        createDriveMock()
      )
      const result = await useCase.getDownloadStream("missing")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(404)
      }
    })

    it("retorna 400 quando backup não está success", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            ...baseRecord,
            status: "pending",
            finishedAt: null,
            googleDriveFileId: null,
          }),
        }),
        createExportMock(),
        createDriveMock()
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(400)
        expect(result.message).toContain("indisponível")
      }
    })

    it("faz proxy autenticado via Drive API quando backup tem googleDriveFileId", async () => {
      const downloadedIds: string[] = []
      const fakeStream = new ReadableStream()
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({ ...baseRecord }),
        }),
        createExportMock(),
        createDriveMock({
          downloadStream: async (fileId) => {
            downloadedIds.push(fileId)
            return fakeStream
          },
        })
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.contentType).toBe("application/zip")
        expect(result.body).toBe(fakeStream)
      }
      expect(downloadedIds[0]).toBe("drive-file-id-1")
    })

    it("retorna 502 quando Drive API falha no download", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({ ...baseRecord }),
        }),
        createExportMock(),
        createDriveMock({
          downloadStream: async () => {
            throw new Error("Drive indisponível")
          },
        })
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(502)
      }
    })

    it("retorna 410 para backup legado sem googleDriveFileId", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            ...baseRecord,
            googleDriveFileId: null,
            filePath: "/old/path/backup.zip",
            fileName: "backup-old.zip",
          }),
        }),
        createExportMock(),
        createDriveMock()
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(410)
      }
    })
  })
})
