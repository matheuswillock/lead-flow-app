export type TeamStudioDnsAuditStatus = 'verified' | 'pending' | 'failed' | 'inconclusive'

export interface StudioDomainDnsAudit {
  id: string
  teamStudioDomainId: string
  dnsAuditStatus: TeamStudioDnsAuditStatus
  dnsReasonCode: string | null
  dnsMisconfigured: boolean | null
  dnsFingerprint: string
  dnsLastCheckedAt: Date
  recommendedCNAME: string | null
}

export interface DnsAuditFingerprint {
  fingerprint: string
  status: TeamStudioDnsAuditStatus
  timestamp: Date
  cname: string | null
  reasonCode: string | null
}