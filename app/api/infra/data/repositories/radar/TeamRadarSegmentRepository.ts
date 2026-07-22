import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type TeamRadarSegmentSelect = {
  id: string
  teamId: string
  createdBy: string
  name: string
  description: string | null
  rulesJson: Prisma.JsonValue
  isSystem: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const segmentSelect = {
  id: true,
  teamId: true,
  createdBy: true,
  name: true,
  description: true,
  rulesJson: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamRadarSegmentSelect

export interface ITeamRadarSegmentRepository {
  listByTeam(teamId: string, options?: { onlyActive?: boolean }): Promise<TeamRadarSegmentSelect[]>
  findById(teamId: string, segmentId: string): Promise<TeamRadarSegmentSelect | null>
  create(data: Prisma.TeamRadarSegmentCreateInput): Promise<TeamRadarSegmentSelect>
  update(segmentId: string, data: Prisma.TeamRadarSegmentUpdateInput): Promise<TeamRadarSegmentSelect>
  delete(segmentId: string): Promise<void>
}

export class TeamRadarSegmentRepository implements ITeamRadarSegmentRepository {
  async listByTeam(teamId: string, options?: { onlyActive?: boolean }) {
    return prisma.teamRadarSegment.findMany({
      where: { teamId, ...(options?.onlyActive ? { isActive: true } : {}) },
      select: segmentSelect,
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(teamId: string, segmentId: string) {
    return prisma.teamRadarSegment.findFirst({
      where: { id: segmentId, teamId },
      select: segmentSelect,
    })
  }

  async create(data: Prisma.TeamRadarSegmentCreateInput) {
    return prisma.teamRadarSegment.create({ data, select: segmentSelect })
  }

  async update(segmentId: string, data: Prisma.TeamRadarSegmentUpdateInput) {
    return prisma.teamRadarSegment.update({ where: { id: segmentId }, data, select: segmentSelect })
  }

  async delete(segmentId: string) {
    await prisma.teamRadarSegment.delete({ where: { id: segmentId } })
  }
}

export const teamRadarSegmentRepository = new TeamRadarSegmentRepository()
