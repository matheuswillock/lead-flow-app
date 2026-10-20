export const studioDomainDnsAuditStatuses = [
  "verified",
  "pending",
  "failed",
  "inconclusive",
] as const

export type StudioDomainDnsAuditStatus = (typeof studioDomainDnsAuditStatuses)[number]

export type StudioDomainDnsAuditReasonCode =
  | "verified"
  | "domain_not_found"
  | "domain_ownership_pending"
  | "dns_misconfigured"
  | "vercel_not_configured"
  | "project_domain_query_failed"
  | "domain_config_query_failed"
  | "audit_failed"

export type StudioDomainDnsAuditResult = {
  hostname: string
  status: StudioDomainDnsAuditStatus
  misconfigured: boolean
  recommendedCNAME: string | null
  reasonCode: StudioDomainDnsAuditReasonCode
  reason: string
  fingerprint: string
}
