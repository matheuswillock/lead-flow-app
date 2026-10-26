import type { TeamLandingDomain } from "@prisma/client"

export interface ITeamLandingDomainRepository {
  findByTeamId(teamId: string): Promise<TeamLandingDomain | null>
  findByHostname(hostname: string): Promise<TeamLandingDomain | null>
  create(input: { teamId: string; hostname: string; vercelDomainId?: string | null }): Promise<TeamLandingDomain>
  saveCheckResult(id: string, input: { status: "pending" | "verified" | "failed"; verifiedAt?: Date | null; lastCheckedAt: Date }): Promise<TeamLandingDomain>
  deleteById(id: string): Promise<void>
}
