import type { BackofficeDatabaseBackupStatus } from "@prisma/client"

export type BackofficeDatabaseBackupRecord = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  status: BackofficeDatabaseBackupStatus
  filePath: string | null
  fileName: string | null
  sizeBytes: bigint | null
  checksumSha256: string | null
  storageSyncPath: string | null
  errorMessage: string | null
  createdAt: Date
}

export interface IBackofficeDatabaseBackupRepository {
  createPending(): Promise<{ id: string }>
  update(
    id: string,
    data: {
      status?: BackofficeDatabaseBackupStatus
      finishedAt?: Date | null
      filePath?: string | null
      fileName?: string | null
      sizeBytes?: bigint | null
      checksumSha256?: string | null
      storageSyncPath?: string | null
      errorMessage?: string | null
    }
  ): Promise<void>
  list(limit?: number): Promise<BackofficeDatabaseBackupRecord[]>
  findById(id: string): Promise<BackofficeDatabaseBackupRecord | null>
}
