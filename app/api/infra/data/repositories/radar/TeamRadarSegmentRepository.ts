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
  parentId: string | null
  sourceType: "manual" | "campaign" | "child"
  sourceCampaignId: string | null
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
  parentId: true,
  sourceType: true,
  sourceCampaignId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamRadarSegmentSelect

export type TeamRadarSegmentWithHierarchy = TeamRadarSegmentSelect & {
  parent: { id: string; name: string } | null
  children: Array<{ id: string; name: string }>
  sourceCampaign: { id: string; name: string } | null
}

export interface ITeamRadarSegmentRepository {
  listByTeam(teamId: string, options?: { onlyActive?: boolean }): Promise<TeamRadarSegmentSelect[]>
  listWithHierarchy(teamId: string, options?: { onlyActive?: boolean }): Promise<TeamRadarSegmentWithHierarchy[]>
  findById(teamId: string, segmentId: string): Promise<TeamRadarSegmentSelect | null>
  create(data: Prisma.TeamRadarSegmentCreateInput): Promise<TeamRadarSegmentSelect>
  update(segmentId: string, data: Prisma.TeamRadarSegmentUpdateInput): Promise<TeamRadarSegmentSelect>
  delete(segmentId: string): Promise<void>
  removeWithLock(teamId: string, segmentId: string): Promise<{ removed: boolean; softDeleted: boolean }>
}

export class TeamRadarSegmentRepository implements ITeamRadarSegmentRepository {
  async listByTeam(teamId: string, options?: { onlyActive?: boolean }) {
    return prisma.teamRadarSegment.findMany({
      where: { teamId, ...(options?.onlyActive ? { isActive: true } : {}) },
      select: segmentSelect,
      orderBy: { createdAt: "desc" },
    })
  }

  async listWithHierarchy(teamId: string, options?: { onlyActive?: boolean }) {
    const segments = await prisma.teamRadarSegment.findMany({
      where: { teamId, ...(options?.onlyActive ? { isActive: true } : {}) },
      select: {
        ...segmentSelect,
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true }, orderBy: { createdAt: "desc" } },
        sourceCampaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return segments.map((segment) => ({
      id: segment.id,
      teamId: segment.teamId,
      createdBy: segment.createdBy,
      name: segment.name,
      description: segment.description,
      rulesJson: segment.rulesJson,
      isSystem: segment.isSystem,
      isActive: segment.isActive,
      parentId: segment.parentId,
      sourceType: segment.sourceType,
      sourceCampaignId: segment.sourceCampaignId,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt,
      parent: segment.parent,
      children: segment.children,
      sourceCampaign: segment.sourceCampaign,
    }))
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

  /**
   * Atômico via `pg_advisory_xact_lock` (mesma chave de
   * lib/radar/segment-audience.ts#radarSegmentLockKey — não importada aqui
   * para evitar dependência circular, já que esse módulo importa este
   * repositório) para serializar contra EmailCampaignUseCase.create: sem o
   * lock, uma campanha pode validar o segmento como ativo, e este método
   * excluí-lo fisicamente antes do insert da campanha completar, deixando
   * `custom:{id}` órfão.
   *
   * `custom:` deve ficar em sincronia com CUSTOM_RADAR_SEGMENT_PREFIX.
   */
  async removeWithLock(teamId: string, segmentId: string): Promise<{ removed: boolean; softDeleted: boolean }> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${teamId}:segment:${segmentId}`}))`

      const existing = await tx.teamRadarSegment.findFirst({ where: { id: segmentId, teamId } })
      if (!existing) return { removed: false, softDeleted: false }

      const referencingCampaigns = await tx.emailCampaign.count({
        where: {
          teamId,
          radarSegmentSlug: `custom:${segmentId}`,
          status: { notIn: ["canceled", "archived"] },
        },
      })

      if (referencingCampaigns > 0) {
        await tx.teamRadarSegment.update({ where: { id: segmentId }, data: { isActive: false } })
        return { removed: true, softDeleted: true }
      }

      await tx.teamRadarSegment.delete({ where: { id: segmentId } })
      return { removed: true, softDeleted: false }
    })
  }
}

export const teamRadarSegmentRepository = new TeamRadarSegmentRepository()
