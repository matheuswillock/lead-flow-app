import type { BackofficeDatabaseBackupSource } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/BackofficeDatabaseBackupRepository"
import type { IBackofficeDatabaseBackupRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupRepository"
import { BackofficeDatabaseBackupExportService } from "@/app/api/services/backofficeDatabaseBackup/BackofficeDatabaseBackupExportService"
import type {
  IBackofficeDatabaseBackupExportService,
  BackupArchiveStats,
} from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupExportService"
import { BackofficeDatabaseBackupGoogleDriveService } from "@/app/api/services/backofficeDatabaseBackup/BackofficeDatabaseBackupGoogleDriveService"
import type { IBackofficeDatabaseBackupGoogleDriveService } from "@/app/api/services/backofficeDatabaseBackup/IBackofficeDatabaseBackupGoogleDriveService"

const MAX_ERROR_SUMMARY_LENGTH = 240

/**
 * Resume a causa raiz em uma linha para caber no `errorSummary` do cron.
 *
 * O `withCronAudit` deriva o resumo de `errorMessages.join("; ")` e corta na
 * primeira quebra de linha, então uma mensagem multi-linha (típica de erro do
 * Prisma) chegaria truncada e sem a causa. Achatar aqui é o que faz o operador
 * enxergar "Invalid string length" sem abrir o banco.
 */
function summarizeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const firstMeaningfulLine = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstMeaningfulLine) return "causa não identificada"

  return firstMeaningfulLine.length > MAX_ERROR_SUMMARY_LENGTH
    ? `${firstMeaningfulLine.slice(0, MAX_ERROR_SUMMARY_LENGTH - 3)}...`
    : firstMeaningfulLine
}

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
  googleDriveFileId: string | null
  googleDriveDownloadUrl: string | null
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
    googleDriveFileId: row.googleDriveFileId,
    createdAt: row.createdAt.toISOString(),
  }
}

export class BackofficeDatabaseBackupUseCase {
  constructor(
    private readonly repository: IBackofficeDatabaseBackupRepository = new BackofficeDatabaseBackupRepository(),
    private readonly exportService: IBackofficeDatabaseBackupExportService = new BackofficeDatabaseBackupExportService(),
    private readonly driveService: IBackofficeDatabaseBackupGoogleDriveService = new BackofficeDatabaseBackupGoogleDriveService()
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
      const { fileId, stats, fileName } = await this.uploadArchive()

      await this.repository.update(pending.id, {
        status: "success",
        finishedAt: new Date(),
        fileName,
        sizeBytes: BigInt(stats.sizeBytes),
        checksumSha256: stats.checksumSha256,
        googleDriveFileId: fileId,
      })

      console.info("[BackofficeDatabaseBackupUseCase][runBackupJob] success", {
        id: pending.id,
        source: input.source,
        triggeredByProfileId: input.triggeredByProfileId ?? null,
        modelCount: stats.modelCount,
        rowCount: stats.rowCount,
        sizeBytes: stats.sizeBytes,
      })
      return new Output(true, ["Backup concluído"], [], { id: pending.id })
    } catch (error) {
      console.error("[BackofficeDatabaseBackupUseCase][runBackupJob]", error)
      await this.repository.update(pending.id, {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      return new Output(
        false,
        [],
        [`Erro ao gerar backup: ${summarizeFailure(error)}`],
        { id: pending.id }
      )
    }
  }

  /**
   * Gera e envia o arquivo em stream: o ZIP é consumido pelo Drive enquanto o
   * export ainda lê o banco, então nada é materializado em memória.
   */
  private async uploadArchive(): Promise<{
    fileId: string
    fileName: string
    stats: BackupArchiveStats
  }> {
    const archive = this.exportService.createArchive()

    let fileId: string
    try {
      const uploaded = await this.driveService.upload({
        body: archive.body,
        fileName: archive.fileName,
      })
      fileId = uploaded.fileId
    } catch (uploadError) {
      archive.abort(
        uploadError instanceof Error ? uploadError : new Error(String(uploadError))
      )
      // Quando o export falha, o upload só enxerga o stream quebrado. A causa
      // raiz está em `completion` — é ela que precisa chegar ao operador.
      const exportError = await archive.completion.then(
        () => null,
        (error: unknown) => error
      )
      throw exportError ?? uploadError
    }

    const stats = await archive.completion
    return { fileId, fileName: archive.fileName, stats }
  }

  async getDownloadStream(id: string): Promise<
    | { ok: true; fileName: string; body: ReadableStream<Uint8Array> | null; contentType: string }
    | { ok: false; status: number; message: string }
  > {
    const backup = await this.repository.findById(id)
    if (!backup) {
      return { ok: false, status: 404, message: "Backup não encontrado" }
    }
    if (backup.status !== "success") {
      return { ok: false, status: 400, message: "Backup indisponível para download" }
    }

    // Download via Drive API — arquivo permanece privado, acesso autenticado.
    if (backup.googleDriveFileId) {
      try {
        const body = await this.driveService.downloadStream(backup.googleDriveFileId)
        return {
          ok: true,
          fileName: backup.fileName ?? `backup-${backup.id}.zip`,
          body,
          contentType: "application/zip",
        }
      } catch (error) {
        console.error("[BackofficeDatabaseBackupUseCase][getDownloadStream]", error)
        return {
          ok: false,
          status: 502,
          message: error instanceof Error ? error.message : "Erro ao baixar backup do Drive",
        }
      }
    }

    return {
      ok: false,
      status: 410,
      message: "Arquivo de backup não disponível. Este backup é anterior à migração para Google Drive e o arquivo original não pode mais ser acessado.",
    }
  }
}

export const backofficeDatabaseBackupUseCase =
  new BackofficeDatabaseBackupUseCase()
