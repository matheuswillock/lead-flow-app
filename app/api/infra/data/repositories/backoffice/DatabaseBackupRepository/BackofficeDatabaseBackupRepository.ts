import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeDatabaseBackupRecord,
  CreatePendingBackupInput,
  IBackofficeDatabaseBackupRepository,
} from "./IBackofficeDatabaseBackupRepository"
import type { BackofficeDatabaseBackupStatus } from "@prisma/client"

export class BackofficeDatabaseBackupRepository implements IBackofficeDatabaseBackupRepository {
  async createPending(input: CreatePendingBackupInput): Promise<{ id: string }> {
    return prisma.backofficeDatabaseBackup.create({
      data: {
        status: "pending",
        source: input.source,
        triggeredByProfileId: input.triggeredByProfileId ?? null,
      },
      select: { id: true },
    })
  }

  async hasPending(): Promise<boolean> {
    const pending = await prisma.backofficeDatabaseBackup.findFirst({
      where: { status: "pending" },
      select: { id: true },
    })
    return pending != null
  }

  async update(
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
  ): Promise<void> {
    await prisma.backofficeDatabaseBackup.update({
      where: { id },
      data,
    })
  }

  async list(limit = 50): Promise<BackofficeDatabaseBackupRecord[]> {
    return prisma.backofficeDatabaseBackup.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    })
  }

  async findById(id: string): Promise<BackofficeDatabaseBackupRecord | null> {
    return prisma.backofficeDatabaseBackup.findUnique({ where: { id } })
  }
}
