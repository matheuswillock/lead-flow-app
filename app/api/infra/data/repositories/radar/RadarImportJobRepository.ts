import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export class RadarImportJobRepository {
  async create(data: Prisma.RadarImportJobCreateInput) {
    return prisma.radarImportJob.create({
      data,
      select: { id: true, importId: true },
    })
  }

  async findByImportId(teamId: string, importId: string) {
    return prisma.radarImportJob.findFirst({
      where: { teamId, importId },
      select: {
        importId: true,
        status: true,
        baseName: true,
        totalRows: true,
        processedRows: true,
        createdCount: true,
        enrichedCount: true,
        skippedCount: true,
        deferredCount: true,
        skippedIssues: true,
        failedBatches: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async claimPendingJob() {
    return prisma.$transaction(async (tx) => {
      const pending = await tx.radarImportJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
      })
      if (!pending) return null

      const updated = await tx.radarImportJob.updateMany({
        where: { id: pending.id, status: "pending" },
        data: { status: "processing" },
      })
      if (updated.count !== 1) return null
      return pending
    })
  }

  async updateJob(id: string, data: Prisma.RadarImportJobUpdateInput) {
    return prisma.radarImportJob.update({ where: { id }, data })
  }

  async findProfileData(profileId: string, teamId: string) {
    return prisma.radarProfile.findFirst({
      where: { id: profileId, teamId },
      select: { profileData: true, gender: true, genderSource: true },
    })
  }
}

export const radarImportJobRepository = new RadarImportJobRepository()
