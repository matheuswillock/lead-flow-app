import { describe, expect, it, mock } from "bun:test"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import type { IBackofficeDatabaseBackupVpsService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupVpsService"
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
    it("serializa sizeBytes bigint para number e inclui source", async () => {
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          list: async () => [
            {
              id: "b1",
              startedAt: new Date("2026-07-24T08:00:00.000Z"),
              finishedAt: new Date("2026-07-24T08:05:00.000Z"),
              status: "success",
              source: "cron",
              triggeredByProfileId: null,
              filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
              fileName: "full.dump",
              sizeBytes: BigInt(2048),
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
    it("cria pending com source=cron e marca success quando VPS responde ok", async () => {
      const claimCalls: Array<{ source: string; triggeredByProfileId?: string | null }> = []
      const lastUpdate: {
        status?: string
        fileName?: string | null
        checksumSha256?: string | null
        sizeBytes?: bigint | null
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
        createVpsMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(true)
      expect((output.result as { id: string }).id).toBe("backup-1")
      expect(claimCalls[0]).toEqual({ source: "cron", triggeredByProfileId: null })
      expect(lastUpdate[0]?.status).toBe("success")
      expect(lastUpdate[0]?.fileName).toBe("full.dump")
      expect(lastUpdate[0]?.checksumSha256).toBe("abc123")
      expect(lastUpdate[0]?.sizeBytes).toEqual(BigInt(1024))
    })

    it("bloqueia quando o slot pending já está ocupado", async () => {
      const claimPendingSlot = mock(async () => ({ ok: false as const, reason: "busy" as const }))
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          claimPendingSlot,
        }),
        createVpsMock()
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("em andamento")
      expect(claimPendingSlot).toHaveBeenCalled()
    })

    it("marca failed quando VPS retorna erro", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createVpsMock({
          runBackup: async () => ({ ok: false, error: "pg_dump failed" }),
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("Falha ao executar backup")
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("pg_dump failed")
    })

    it("marca failed quando VPS lança exceção", async () => {
      const lastUpdate: Array<{ status?: string; errorMessage?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          update: async (_id, data) => {
            lastUpdate.push(data)
          },
        }),
        createVpsMock({
          runBackup: async () => {
            throw new Error("network down")
          },
        })
      )

      const output = await useCase.triggerCronBackup()
      expect(output.isValid).toBe(false)
      expect(lastUpdate[0]?.status).toBe("failed")
      expect(lastUpdate[0]?.errorMessage).toBe("network down")
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
        createVpsMock()
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
      const claimPendingSlot = mock(async () => ({ ok: false as const, reason: "busy" as const }))
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          claimPendingSlot,
        }),
        createVpsMock()
      )

      const output = await useCase.triggerManualBackup("profile-manager-1")
      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("em andamento")
      expect(claimPendingSlot).toHaveBeenCalled()
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
            source: "cron",
            triggeredByProfileId: null,
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
      const downloaded: Array<{ fileName: string; filePath?: string | null }> = []
      const useCase = new BackofficeDatabaseBackupUseCase(
        createRepoMock({
          findById: async () => ({
            id: "b1",
            startedAt: new Date(),
            finishedAt: new Date(),
            status: "success",
            source: "manual",
            triggeredByProfileId: "profile-1",
            filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
            fileName: "full.dump",
            sizeBytes: BigInt(10),
            checksumSha256: "x",
            storageSyncPath: null,
            errorMessage: null,
            createdAt: new Date(),
          }),
        }),
        createVpsMock({
          downloadBackup: async (input) => {
            downloaded.push(input)
            return new Response(new Uint8Array([9]), {
              status: 200,
              headers: { "Content-Type": "application/gzip" },
            })
          },
        })
      )

      const result = await useCase.getDownloadStream("b1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.fileName).toBe("full.dump")
        expect(result.contentType).toBe("application/gzip")
      }
      expect(downloaded[0]).toEqual({
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
            source: "cron",
            triggeredByProfileId: null,
            filePath: "/opt/lead-flow-app/backups/2026-07-24/full.dump",
            fileName: "full.dump",
            sizeBytes: BigInt(10),
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
