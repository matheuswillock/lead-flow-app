import type { TeamStudioDnsAuditStatus, TeamStudioDomainStatus } from "@prisma/client"

export type TeamStudioDomainRecord = {
  id: string
  teamId: string
  hostname: string
  status: TeamStudioDomainStatus
  vercelDomainId: string | null
  verifiedAt: Date | null
  lastCheckedAt: Date | null
  dnsAuditStatus: TeamStudioDnsAuditStatus | null
  dnsMisconfigured: boolean | null
  dnsReasonCode: string | null
  dnsReason: string | null
  recommendedCNAME: string | null
  lastDnsAuditAt: Date | null
  lastDnsAttemptAt: Date | null
  lastDnsFingerprint: string | null
  lastDnsNotifiedFingerprint: string | null
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

export type SaveTeamStudioDnsAuditInput = {
  dnsAuditStatus: TeamStudioDnsAuditStatus
  dnsMisconfigured: boolean
  dnsReasonCode?: string | null
  dnsReason?: string | null
  recommendedCNAME?: string | null
  lastDnsAuditAt?: Date
  lastDnsAttemptAt: Date
  lastDnsFingerprint?: string | null
}

export type MarkTeamStudioDnsAuditNotifiedInput = {
  fingerprint: string
}

export type UpdateTeamStudioTrackingInput = {
  headScripts: string | null
  bodyStartScripts: string | null
  bodyEndScripts: string | null
}

export interface ITeamStudioDomainRepository {
  listAll(): Promise<TeamStudioDomainRecord[]>
  findByTeamId(teamId: string): Promise<TeamStudioDomainRecord | null>
  findByHostname(hostname: string): Promise<TeamStudioDomainRecord | null>
  create(input: CreateTeamStudioDomainInput): Promise<TeamStudioDomainRecord>
  saveCheckResult(
    id: string,
    input: SaveTeamStudioDomainCheckInput,
  ): Promise<TeamStudioDomainRecord>
  saveDnsAuditResult(
    id: string,
    input: SaveTeamStudioDnsAuditInput,
  ): Promise<TeamStudioDomainRecord>
  markDnsAuditNotified(
    id: string,
    input: MarkTeamStudioDnsAuditNotifiedInput,
  ): Promise<TeamStudioDomainRecord>
  updateTracking?(
    teamId: string,
    input: UpdateTeamStudioTrackingInput,
  ): Promise<TeamStudioDomainRecord | null>
  deleteById(id: string): Promise<void>
}
