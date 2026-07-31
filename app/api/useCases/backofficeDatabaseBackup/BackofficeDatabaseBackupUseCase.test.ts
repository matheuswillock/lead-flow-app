import { describe, expect, it, mock } from "bun:test"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import type { IBackofficeDatabaseBackupExportService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupExportService"
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

function createExportMock(
  overrides: Partial<IBackofficeDatabaseBackupExportService> = {}
): IBackofficeDatabaseBackupExportService {
  return {
    exportToZip: async () => ({
      buffer: Buffer.from("zip-content"),
      fileName: "backup-2026-07-31-10-00.zip",
      sizeBytes: 1024,
      checksumSha256: "abc123",
    }),
    ...overrides,
  }
}

function createDriveMock(
  overrides: Partial<IBackofficeDatabaseBackupGoogleDriveService> = {}
): IBackofficeDatabaseBackupGoogleDriveService {
  return {
    upload: async () => ({
      fileId: "drive-file-id-1",
      downloadUrl: "https://drive.google.com/uc?export=download&id=drive-file-id-1",
    }),
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
  googleDriveDownloadUrl:
    "https://drive.google.com/uc?export=download&id=drive-file-id-1",
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
    it("cria pending com source=cron e marca success com dados do Drive", async () => {
      const claimCalls: Array<{ source: string; triggeredByProfileId?: string | null }> = []
      const lastUpdate: {
        status?: string
        fileName?: string | null
        checksumSha256?: string | null
        sizeBytes?: bigint | null
        googleDriveFileId?: string | null
        googleDriveDownloadUrl?: string | null
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
      expect(lastUpdate[0]?.googleDriveDownloadUrl).toContain("drive-file-id-1")
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

    it("marca failed quando o export service lança exceção", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock({
          exportToZip: async () => {
            throw new Error("Falha ao exportar dados")
          },
        }),
        createDriveMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Erro ao gerar backup")
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("Falha ao exportar dados")
    })

    it("marca failed quando o drive service lança exceção", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createExportMock(),
        createDriveMock({
          upload: async () => {
            throw new Error("Upload falhou")
          },
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("Upload falhou")
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
            googleDriveDownloadUrl: null,
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

    it("retorna redirect para Google Drive quando backup tem googleDriveDownloadUrl", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({ ...baseRecord }),
        }),
        createExportMock(),
        createDriveMock()
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.redirect).toBe(true)
        if (result.redirect) {
          expect(result.url).toContain("drive.google.com")
        }
      }
    })

    it("retorna 400 quando backup success não tem URL de download", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            ...baseRecord,
            googleDriveFileId: null,
            googleDriveDownloadUrl: null,
            filePath: null,
            fileName: null,
          }),
        }),
        createExportMock(),
        createDriveMock()
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(400)
      }
    })
  })
})
