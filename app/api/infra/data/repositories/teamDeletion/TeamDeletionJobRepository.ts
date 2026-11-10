import type { Prisma, TeamDeletionExportJob } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  ITeamDeletionJobStore,
  NewTeamDeletionJob,
  TeamDeletionJobRecord,
  TeamDeletionJobStatus,
} from "@/app/api/shared/teamDeletion/teamDeletionTypes"

function toRecord(row: TeamDeletionExportJob): TeamDeletionJobRecord {
  return {
    id: row.id,
    teamId: row.teamId,
    teamName: row.teamName,
    requesterProfileId: row.requesterProfileId,
    requesterEmail: row.requesterEmail,
    requesterName: row.requesterName,
    billingOwnerId: row.billingOwnerId,
    status: row.status as TeamDeletionJobStatus,
    attempts: row.attempts,
    filePath: row.filePath,
    expiresAt: row.expiresAt,
    counts: (row.counts as Record<string, number> | null) ?? null,
  }
}

/** Fila dos pedidos de exportação feitos ao excluir um time (sem vínculo com o time: sobrevive à exclusão). */
export class TeamDeletionJobRepository implements ITeamDeletionJobStore {
  async create(input: NewTeamDeletionJob): Promise<TeamDeletionJobRecord> {
    const row = await prisma.teamDeletionExportJob.create({ data: { ...input } })
    return toRecord(row)
  }

  async reclaimStale(olderThan: Date): Promise<number> {
    const result = await prisma.teamDeletionExportJob.updateMany({
      where: { status: "processing", lockedAt: { lt: olderThan } },
      data: { status: "pending", lockedAt: null },
    })
    return result.count
  }

  async claimNext(): Promise<TeamDeletionJobRecord | null> {
    // Duas execuções do cron ao mesmo tempo: só uma consegue mudar o pedido de "pending" para "processing".
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = await prisma.teamDeletionExportJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      if (!candidate) return null
      const claimed = await prisma.teamDeletionExportJob.updateMany({
        where: { id: candidate.id, status: "pending" },
        data: { status: "processing", lockedAt: new Date(), attempts: { increment: 1 } },
      })
      if (claimed.count === 1) {
        const row = await prisma.teamDeletionExportJob.findUnique({ where: { id: candidate.id } })
        return row ? toRecord(row) : null
      }
    }
    return null
  }

  async markReady(
    id: string,
    input: { filePath: string; fileSizeBytes: number; expiresAt: Date; counts: Record<string, number> },
  ): Promise<void> {
    await prisma.teamDeletionExportJob.update({
      where: { id },
      data: {
        status: "ready",
        filePath: input.filePath,
        fileSizeBytes: input.fileSizeBytes,
        expiresAt: input.expiresAt,
        counts: input.counts as Prisma.InputJsonValue,
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    })
  }

  async markFailed(id: string, message: string): Promise<void> {
    await prisma.teamDeletionExportJob.update({
      where: { id },
      data: { status: "failed", lastError: message.slice(0, 1000), lockedAt: null, completedAt: new Date() },
    })
  }

  async requeue(id: string, message: string): Promise<void> {
    await prisma.teamDeletionExportJob.update({
      where: { id },
      data: { status: "pending", lastError: message.slice(0, 1000), lockedAt: null },
    })
  }

  async findById(id: string): Promise<TeamDeletionJobRecord | null> {
    const row = await prisma.teamDeletionExportJob.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async registerDownload(id: string, profileId: string, at: Date): Promise<void> {
    await prisma.teamDeletionExportJob.update({
      where: { id },
      data: { downloadCount: { increment: 1 }, lastDownloadedAt: at, lastDownloadedBy: profileId },
    })
  }

  async listExpired(now: Date): Promise<TeamDeletionJobRecord[]> {
    const rows = await prisma.teamDeletionExportJob.findMany({
      where: { status: "ready", expiresAt: { lte: now } },
      orderBy: { expiresAt: "asc" },
      take: 50,
    })
    return rows.map(toRecord)
  }

  async markPurged(id: string, at: Date): Promise<void> {
    await prisma.teamDeletionExportJob.update({
      where: { id },
      data: { status: "purged", purgedAt: at, filePath: null },
    })
  }
}

export const teamDeletionJobRepository = new TeamDeletionJobRepository()
