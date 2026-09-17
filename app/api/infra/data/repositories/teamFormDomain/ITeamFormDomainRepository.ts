import type { TeamFormDomainStatus } from "@prisma/client"

export type TeamFormDomainRecord = {
  id: string
  teamId: string
  hostname: string
  status: TeamFormDomainStatus
  vercelDomainId: string | null
  verifiedAt: Date | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CreateTeamFormDomainInput = {
  teamId: string
  hostname: string
  vercelDomainId?: string | null
}

export type SaveTeamFormDomainCheckInput = {
  status: TeamFormDomainStatus
  verifiedAt?: Date | null
  lastCheckedAt: Date
}

export interface ITeamFormDomainRepository {
  findByTeamId(teamId: string): Promise<TeamFormDomainRecord | null>
  findByHostname(hostname: string): Promise<TeamFormDomainRecord | null>
  create(input: CreateTeamFormDomainInput): Promise<TeamFormDomainRecord>
  saveCheckResult(id: string, input: SaveTeamFormDomainCheckInput): Promise<TeamFormDomainRecord>
  deleteById(id: string): Promise<void>
  /** Domínios não verificados para o cron de reconciliação, mais antigos primeiro. */
  listPendingOrFailed(limit: number): Promise<TeamFormDomainRecord[]>
}
