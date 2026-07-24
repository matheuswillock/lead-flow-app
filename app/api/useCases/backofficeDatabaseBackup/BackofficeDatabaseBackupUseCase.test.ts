import { describe, expect, it, mock } from "bun:test"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import type { IBackofficeDatabaseBackupVpsService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupVpsService"
import { BackofficeDatabaseBackupUseCase } from "./BackofficeDatabaseBackupUseCase"

function createRepoMock(
  overrides: Partial<IBackofficeDatabaseBackupRepository> = {}
): IBackofficeDatabaseBackupRepository {
  return {
    createPending: async () => ({ id: "backup-1" }),
    update: async () => undefined,
    list: async () => [],
    findById: async () => null,
    ...overrides,
  }
}

function createVpsMock(
  overrides: Partial<IBackofficeDatabaseBackupVpsService> = {}
): IBackofficeDatabaseBackupVpsService {
  return {
    runBackup: async () => ({
      ok: true,
      filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
      fileName: "full.dump",
      sizeBytes: 1024,
      checksumSha256: "abc123",
      storageSyncPath: null,
    }),
    downloadBackup: async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    ...overrides,
  }
}

describe("BackofficeDatabaseBackupUseCase", () => {
  describe("list", () => {
    it("serializa sizeBytes bigint para number", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          list: async () => [
            {
              id: "b1",
              startedAt: new Date("2026-07-24T08:00:00.000Z"),
              finishedAt: new Date("2026-07-24T08:05:00.000Z"),
              status: "success",
              filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
              fileName: "full.dump",
              sizeBytes: 2048n,
              checksumSha256: "deadbeef",
              storageSyncPath: null,
              errorMessage: null,
              createdAt: new Date("2026-07-24T08:00:00.000Z"),
            },
          ],
        }),
        createVpsMock()
      )

      const output = await useCase.list()
      expect(output.isValid).toBe(true)
      const items = (output.result as { items: Array<{ sizeBytes: number | null }> }).items
      expect(items[0]?.sizeBytes).toBe(2048)
    })
  })

  describe("triggerCronBackup", () => {
    it("marca success e grava metadados quando VPS responde ok", async () => {
      const update = mock(async () => undefined)
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({ update }),
        createVpsMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(true)
      expect((output.result as { id: string }).id).toBe("backup-1")
      expect(update).toHaveBeenCalledTimes(1)
      const payload = update.mock.calls[0]?.[1] as {
        status: string
        fileName: string | null
        checksumSha256: string | null
        sizeBytes: bigint | null
      }
      expect(payload.status).toBe("success")
      expect(payload.fileName).toBe("full.dump")
      expect(payload.checksumSha256).toBe("abc123")
      expect(payload.sizeBytes).toBe(1024n)
    })

    it("marca failed quando VPS retorna erro", async () => {
      const update = mock(async () => undefined)
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({ update }),
        createVpsMock({
          runBackup: async () => ({ ok: false, error: "pg_dump failed" }),
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("Falha ao executar backup")
      const payload = update.mock.calls[0]?.[1] as {
        status: string
        errorMessage: string | null
      }
      expect(payload.status).toBe("failed")
      expect(payload.errorMessage).toBe("pg_dump failed")
    })

    it("marca failed quando VPS lança exceção", async () => {
      const update = mock(async () => undefined)
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({ update }),
        createVpsMock({
          runBackup: async () => {
            throw new Error("network down")
          },
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      const payload = update.mock.calls[0]?.[1] as {
        status: string
        errorMessage: string | null
      }
      expect(payload.status).toBe("failed")
      expect(payload.errorMessage).toBe("network down")
    })
  })

  describe("getDownloadStream", () => {
    it("retorna 404 quando backup não existe", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(createRepoMock(), createVpsMock())
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
            id: "b1",
            startedAt: new Date(),
            finishedAt: null,
            status: "pending",
            filePath: null,
            fileName: null,
            sizeBytes: null,
            checksumSha256: null,
            storageSyncPath: null,
            errorMessage: null,
            createdAt: new Date(),
          }),
        }),
        createVpsMock()
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(400)
        expect(result.message).toContain("indisponível")
      }
    })

    it("faz proxy do arquivo quando backup está success", async () => {
      const downloadBackup = mock(async () =>
        new Response(new Uint8Array([9]), {
          status: 200,
          headers: { "Content-Type": "application/gzip" },
        })
      )
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            id: "b1",
            startedAt: new Date(),
            finishedAt: new Date(),
            status: "success",
            filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
            fileName: "full.dump",
            sizeBytes: 10n,
            checksumSha256: "x",
            storageSyncPath: null,
            errorMessage: null,
            createdAt: new Date(),
          }),
        }),
        createVpsMock({ downloadBackup })
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.fileName).toBe("full.dump")
        expect(result.contentType).toBe("application/gzip")
      }
      expect(downloadBackup).toHaveBeenCalledWith({
        fileName: "full.dump",
        filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
      })
    })

    it("retorna 502 quando VPS não entrega o arquivo", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            id: "b1",
            startedAt: new Date(),
            finishedAt: new Date(),
            status: "success",
            filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
            fileName: "full.dump",
            sizeBytes: 10n,
            checksumSha256: "x",
            storageSyncPath: null,
            errorMessage: null,
            createdAt: new Date(),
          }),
        }),
        createVpsMock({
          downloadBackup: async () => new Response(null, { status: 500 }),
        })
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(502)
      }
    })
  })
})
