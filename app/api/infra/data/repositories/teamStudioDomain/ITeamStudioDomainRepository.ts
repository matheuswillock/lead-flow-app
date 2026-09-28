import type { TeamStudioDomainStatus } from "@prisma/client"

export type TeamStudioDomainRecord = {
  id: string
  teamId: string
  hostname: string
  status: TeamStudioDomainStatus
  vercelDomainId: string | null
  verifiedAt: Date | null
  lastCheckedAt: Date | null
  headScripts?: string | null
  bodyStartScripts?: string | null
  bodyEndScripts?: string | null
  createdAt: Date
  updatedAt: Date
}

export type CreateTeamStudioDomainInput = {
  teamId: string
  hostname: string
  vercelDomainId?: string | null
}

export type SaveTeamStudioDomainCheckInput = {
  status: TeamStudioDomainStatus
  verifiedAt?: Date | null
  lastCheckedAt: Date
}

export type UpdateTeamStudioTrackingInput = {
  headScripts: string | null
  bodyStartScripts: string | null
  bodyEndScripts: string | null
}

export interface ITeamStudioDomainRepository {
  findByTeamId(teamId: string): Promise<TeamStudioDomainRecord | null>
  findByHostname(hostname: string): Promise<TeamStudioDomainRecord | null>
  create(input: CreateTeamStudioDomainInput): Promise<TeamStudioDomainRecord>
  saveCheckResult(id: string, input: SaveTeamStudioDomainCheckInput): Promise<TeamStudioDomainRecord>
  updateTracking?(teamId: string, input: UpdateTeamStudioTrackingInput): Promise<TeamStudioDomainRecord | null>
  deleteById(id: string): Promise<void>
}
