import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeDatabaseBackupRecord,
  ClaimPendingBackupResult,
  CreatePendingBackupInput,
  IBackofficeDatabaseBackupRepository,
} from "./IBackofficeDatabaseBackupRepository"
import type { BackofficeDatabaseBackupStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"

/** Must be > route maxDuration (300s) so in-flight jobs are not expired mid-run. */
export const BACKUP_PENDING_LEASE_MS = 10 * 60 * 1000

const BACKUP_CLAIM_LOCK_KEY = 874_201_533

export class BackofficeDatabaseBackupRepository implements IBackofficeDatabaseBackupRepository {
  async claimPendingSlot(input: CreatePendingBackupInput): Promise<ClaimPendingBackupResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BACKUP_CLAIM_LOCK_KEY})`

        const leaseCutoff = new Date(Date.now() - BACKUP_PENDING_LEASE_MS)
        await tx.backofficeDatabaseBackup.updateMany({
          where: {
            status: "pending",
            startedAt: { lt: leaseCutoff },
          },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage:
              "Backup abandonado por timeout — liberado automaticamente para novos disparos",
          },
        })

        const existing = await tx.backofficeDatabaseBackup.findFirst({
          where: { status: "pending" },
          select: { id: true },
        })
        if (existing) {
          return { ok: false as const, reason: "busy" as const }
        }

        const created = await tx.backofficeDatabaseBackup.create({
          data: {
            status: "pending",
            source: input.source,
            triggeredByProfileId: input.triggeredByProfileId ?? null,
          },
          select: { id: true },
        })

        return { ok: true as const, id: created.id }
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ok: false, reason: "busy" }
      }
      throw error
    }
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
