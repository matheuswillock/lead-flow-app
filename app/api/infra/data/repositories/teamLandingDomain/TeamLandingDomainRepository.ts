import { prisma } from "@/app/api/infra/data/prisma"
import type { ITeamLandingDomainRepository } from "./ITeamLandingDomainRepository"

export class TeamLandingDomainRepository implements ITeamLandingDomainRepository {
  async findByTeamId(teamId: string) {
    return prisma.teamLandingDomain.findUnique({
      where: { teamId },
      select: { id: true, teamId: true, hostname: true, status: true, vercelDomainId: true, verifiedAt: true, lastCheckedAt: true, createdAt: true, updatedAt: true },
    })
  }

  async findByHostname(hostname: string) {
    return prisma.teamLandingDomain.findUnique({ where: { hostname }, select: { id: true, teamId: true, hostname: true, status: true, vercelDomainId: true, verifiedAt: true, lastCheckedAt: true, createdAt: true, updatedAt: true } })
  }

  async create(input: { teamId: string; hostname: string; vercelDomainId?: string | null }) {
    return prisma.teamLandingDomain.create({ data: input, select: { id: true, teamId: true, hostname: true, status: true, vercelDomainId: true, verifiedAt: true, lastCheckedAt: true, createdAt: true, updatedAt: true } })
  }

  async saveCheckResult(id: string, input: { status: "pending" | "verified" | "failed"; verifiedAt?: Date | null; lastCheckedAt: Date }) {
    return prisma.teamLandingDomain.update({ where: { id }, data: input, select: { id: true, teamId: true, hostname: true, status: true, vercelDomainId: true, verifiedAt: true, lastCheckedAt: true, createdAt: true, updatedAt: true } })
  }

  async deleteById(id: string) {
    await prisma.teamLandingDomain.delete({ where: { id } })
  }
}

export const teamLandingDomainRepository = new TeamLandingDomainRepository()
