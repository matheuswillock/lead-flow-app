import type { BackofficeDatabaseBackupSource } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/BackofficeDatabaseBackupRepository"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import { BackofficeDatabaseBackupVpsService } from "@/app/api/services/backofficeDatabaseBackup/BackofficeDatabaseBackupVpsService"
import type { IBackofficeDatabaseBackupVpsService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupVpsService"

function serializeBackup(row: {
  id: string
  startedAt: Date
  finishedAt: Date | null
  status: string
  source: BackofficeDatabaseBackupSource
  triggeredByProfileId: string | null
  filePath: string | null
  fileName: string | null
  sizeBytes: bigint | null
  checksumSha256: string | null
  storageSyncPath: string | null
  errorMessage: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    status: row.status,
    source: row.source,
    triggeredByProfileId: row.triggeredByProfileId,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
    checksumSha256: row.checksumSha256,
    storageSyncPath: row.storageSyncPath,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }
}

export class BackofficeDatabaseBackupUseCase {
  constructor(
    private readonly repository: IBackofficeDatabaseBackupRepository = new BackofficeDatabaseBackupRepository(),
    private readonly vpsService: IBackofficeDatabaseBackupVpsService = new BackofficeDatabaseBackupVpsService()
  ) {}

  async list(): Promise<Output> {
    try {
      const items = await this.repository.list(100)
      return new Output(true, ["Backups listados"], [], {
        items: items.map(serializeBackup),
      })
    } catch (error) {
      console.error("[BackofficeDatabaseBackupUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar backups"], null)
    }
  }

  async triggerCronBackup(): Promise<Output> {
    return this.runBackupJob({ source: "cron" })
  }

  async triggerManualBackup(triggeredByProfileId: string): Promise<Output> {
    return this.runBackupJob({
      source: "manual",
      triggeredByProfileId,
    })
  }

  private async runBackupJob(input: {
    source: BackofficeDatabaseBackupSource
    triggeredByProfileId?: string | null
  }): Promise<Output> {
    const claimed = await this.repository.claimPendingSlot({
      source: input.source,
      triggeredByProfileId: input.triggeredByProfileId ?? null,
    })

    if (!claimed.ok) {
      return new Output(
        false,
        [],
        ["Já existe um backup em andamento. Aguarde a conclusão antes de disparar outro."],
        null
      )
    }

    const pending = { id: claimed.id }

    console.info("[BackofficeDatabaseBackupUseCase][runBackupJob] started", {
      id: pending.id,
      source: input.source,
      triggeredByProfileId: input.triggeredByProfileId ?? null,
    })

    try {
      const result = await this.vpsService.runBackup(pending.id)

      if (!result.ok) {
        const errorMessage = result.error || "Falha ao executar backup na VPS"
        await this.repository.update(pending.id, {
          status: "failed",
          finishedAt: new Date(),
          errorMessage,
        })
        return new Output(false, [], [errorMessage], {
          id: pending.id,
        })
      }

      await this.repository.update(pending.id, {
        status: "success",
        finishedAt: new Date(),
        filePath: result.filePath ?? null,
        fileName: result.fileName ?? null,
        sizeBytes:
          typeof result.sizeBytes === "number" ? BigInt(result.sizeBytes) : null,
        checksumSha256: result.checksumSha256 ?? null,
        storageSyncPath: result.storageSyncPath ?? null,
      })

      console.info("[BackofficeDatabaseBackupUseCase][runBackupJob] success", {
        id: pending.id,
        source: input.source,
        triggeredByProfileId: input.triggeredByProfileId ?? null,
      })
      return new Output(true, ["Backup concluído"], [], { id: pending.id })
    } catch (error) {
      console.error("[BackofficeDatabaseBackupUseCase][runBackupJob]", error)
      await this.repository.update(pending.id, {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      return new Output(false, [], ["Erro ao disparar backup na VPS"], { id: pending.id })
    }
  }

  async getDownloadStream(id: string): Promise<
    | { ok: true; fileName: string; body: ReadableStream<Uint8Array> | null; contentType: string }
    | { ok: false; status: number; message: string }
  > {
    const backup = await this.repository.findById(id)
    if (!backup) {
      return { ok: false, status: 404, message: "Backup não encontrado" }
    }
    if (backup.status !== "success" || !backup.filePath || !backup.fileName) {
      return { ok: false, status: 400, message: "Backup indisponível para download" }
    }

    try {
      const response = await this.vpsService.downloadBackup({
        fileName: backup.fileName,
        filePath: backup.filePath,
      })

      if (!response.ok || !response.body) {
        return {
          ok: false,
          status: 502,
          message: "Não foi possível obter o arquivo na VPS",
        }
      }

      return {
        ok: true,
        fileName: backup.fileName,
        body: response.body,
        contentType: response.headers.get("content-type") || "application/octet-stream",
      }
    } catch (error) {
      console.error("[BackofficeDatabaseBackupUseCase][getDownloadStream]", error)
      return {
        ok: false,
        status: 500,
        message:
          error instanceof Error ? error.message : "Erro ao baixar backup",
      }
    }
  }
}

export const backofficeDatabaseBackupUseCase = new BackofficeDatabaseBackupUseCase()
