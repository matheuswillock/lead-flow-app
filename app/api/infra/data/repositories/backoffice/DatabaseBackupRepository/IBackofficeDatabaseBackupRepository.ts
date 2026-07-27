import type {
  BackofficeDatabaseBackupSource,
  BackofficeDatabaseBackupStatus,
} from "@prisma/client"

export type BackofficeDatabaseBackupRecord = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  status: BackofficeDatabaseBackupStatus
  source: BackofficeDatabaseBackupSource
  triggeredByProfileId: string | null
  filePath: string | null
  fileName: string | null
  sizeBytes: bigint | null
  checksumSha256: string | null
  storageSyncPath: string | null
  errorMessage: string | null
  createdAt: Date
}

export type CreatePendingBackupInput = {
  source: BackofficeDatabaseBackupSource
  triggeredByProfileId?: string | null
}

export type ClaimPendingBackupResult =
  | { ok: true; id: string }
  | { ok: false; reason: "busy" }

export interface IBackofficeDatabaseBackupRepository {
  /**
   * Atomically expire stale pending rows and claim a new pending slot.
   * Concurrent callers serialize via advisory lock + unique pending index.
   */
  claimPendingSlot(input: CreatePendingBackupInput): Promise<ClaimPendingBackupResult>
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
