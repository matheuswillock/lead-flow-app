import type { Readable } from "node:stream"

export type BackupArchiveStats = {
  sizeBytes: number
  checksumSha256: string
  modelCount: number
  rowCount: number
}

/**
 * Arquivo de backup em produção incremental.
 *
 * `body` é consumido pelo uploader enquanto o export ainda está lendo o banco —
 * o ZIP nunca existe inteiro em memória. `sizeBytes` e `checksumSha256` só são
 * conhecidos depois que o último byte passa, por isso vêm em `completion`.
 */
export type BackupArchive = {
  fileName: string
  body: Readable
  /** Resolve depois que o corpo é totalmente consumido; rejeita com a causa raiz. */
  completion: Promise<BackupArchiveStats>
  /** Interrompe a produção e libera as transações abertas quando o destino falha. */
  abort: (error: Error) => void
}

export interface IBackofficeDatabaseBackupExportService {
  createArchive(): BackupArchive
}
