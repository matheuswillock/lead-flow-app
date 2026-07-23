import type { Prisma } from "@prisma/client"
import {
  teamRadarSegmentRepository,
} from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { parseRadarSegmentRules, type RadarSegmentRules } from "@/lib/radar/segment-dsl"
import type {
  ITeamRadarSegmentService,
  TeamRadarSegmentInput,
  TeamRadarSegmentUpdateInput,
} from "./ITeamRadarSegmentService"

function toJsonInput(rules: RadarSegmentRules): Prisma.InputJsonValue {
  return rules as unknown as Prisma.InputJsonValue
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Unique constraint") || (error as { code?: string }).code === "P2002")
  )
}

export class TeamRadarSegmentService implements ITeamRadarSegmentService {
  async listByTeam(teamId: string, options?: { onlyActive?: boolean }) {
    return teamRadarSegmentRepository.listByTeam(teamId, options)
  }

  async findById(teamId: string, segmentId: string) {
    return teamRadarSegmentRepository.findById(teamId, segmentId)
  }

  async create(teamId: string, createdBy: string, input: TeamRadarSegmentInput) {
    const rules = parseRadarSegmentRules(input.rules)
    try {
      return await teamRadarSegmentRepository.create({
        team: { connect: { id: teamId } },
        creator: { connect: { id: createdBy } },
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rulesJson: toJsonInput(rules),
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error("Já existe um segmento com esse nome")
      }
      throw error
    }
  }

  async update(teamId: string, segmentId: string, input: TeamRadarSegmentUpdateInput) {
    const existing = await teamRadarSegmentRepository.findById(teamId, segmentId)
    if (!existing) return null

    const rules = input.rules !== undefined ? parseRadarSegmentRules(input.rules) : undefined

    try {
      return await teamRadarSegmentRepository.update(segmentId, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(rules !== undefined ? { rulesJson: toJsonInput(rules) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error("Já existe um segmento com esse nome")
      }
      throw error
    }
  }

  async remove(teamId: string, segmentId: string) {
    return teamRadarSegmentRepository.removeWithLock(teamId, segmentId)
  }
}

export const teamRadarSegmentService = new TeamRadarSegmentService()
