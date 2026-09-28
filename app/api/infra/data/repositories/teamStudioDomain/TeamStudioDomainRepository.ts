import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateTeamStudioDomainInput,
  ITeamStudioDomainRepository,
  SaveTeamStudioDomainCheckInput,
  TeamStudioDomainRecord,
  UpdateTeamStudioTrackingInput,
} from "./ITeamStudioDomainRepository"

const TEAM_STUDIO_DOMAIN_SELECT = {
  id: true,
  teamId: true,
  hostname: true,
  status: true,
  vercelDomainId: true,
  verifiedAt: true,
  lastCheckedAt: true,
  headScripts: true,
  bodyStartScripts: true,
  bodyEndScripts: true,
  createdAt: true,
  updatedAt: true,
} as const

export class TeamStudioDomainRepository implements ITeamStudioDomainRepository {
  async findByTeamId(teamId: string): Promise<TeamStudioDomainRecord | null> {
    return prisma.teamStudioDomain.findUnique({ where: { teamId }, select: TEAM_STUDIO_DOMAIN_SELECT })
  }

  async findByHostname(hostname: string): Promise<TeamStudioDomainRecord | null> {
    return prisma.teamStudioDomain.findUnique({ where: { hostname }, select: TEAM_STUDIO_DOMAIN_SELECT })
  }

  async create(input: CreateTeamStudioDomainInput): Promise<TeamStudioDomainRecord> {
    return prisma.teamStudioDomain.create({
      data: {
        teamId: input.teamId,
        hostname: input.hostname,
        vercelDomainId: input.vercelDomainId ?? null,
      },
      select: TEAM_STUDIO_DOMAIN_SELECT,
    })
  }

  async saveCheckResult(
    id: string,
    input: SaveTeamStudioDomainCheckInput,
  ): Promise<TeamStudioDomainRecord> {
    return prisma.teamStudioDomain.update({
      where: { id },
      data: {
        status: input.status,
        lastCheckedAt: input.lastCheckedAt,
        ...(input.verifiedAt !== undefined ? { verifiedAt: input.verifiedAt } : {}),
      },
      select: TEAM_STUDIO_DOMAIN_SELECT,
    })
  }

  async updateTracking(teamId: string, input: UpdateTeamStudioTrackingInput): Promise<TeamStudioDomainRecord | null> {
    const domain = await prisma.teamStudioDomain.findUnique({ where: { teamId }, select: { id: true } })
    if (!domain) return null
    return prisma.teamStudioDomain.update({ where: { id: domain.id }, data: input, select: TEAM_STUDIO_DOMAIN_SELECT })
  }

  async deleteById(id: string): Promise<void> {
    await prisma.teamStudioDomain.delete({ where: { id } })
  }
}

export const teamStudioDomainRepository = new TeamStudioDomainRepository()
