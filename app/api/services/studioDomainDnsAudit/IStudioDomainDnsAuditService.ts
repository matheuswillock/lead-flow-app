export interface IStudioDomainDnsAuditService {
  auditDomain(domain: string): Promise<{
    status: 'verified' | 'pending' | 'failed' | 'inconclusive'
    reason?: string
    recommendedCNAME?: string
    fingerprint: string
  }>
  getAuditStatus(teamStudioDomainId: string): Promise<{
    dnsAuditStatus: 'verified' | 'pending' | 'failed' | 'inconclusive' | null
    dnsLastCheckedAt: Date | null
    dnsReasonCode: string | null
    dnsMisconfigured: boolean | null
    dnsFingerprint: string | null
  }>
  updateAuditStatus(teamStudioDomainId: string, status: 'verified' | 'pending' | 'failed' | 'inconclusive', reason?: string, recommendedCNAME?: string): Promise<void>
}