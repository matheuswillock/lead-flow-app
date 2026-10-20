import { IStudioDomainDnsAuditService } from './IStudioDomainDnsAuditService'
import { IStudioDomainDnsNotificationService } from './IStudioDomainDnsNotificationService'

export class StudioDomainDnsAuditService implements IStudioDomainDnsAuditService {
  constructor(private readonly notificationService: IStudioDomainDnsNotificationService) {}

  async auditDomain(domain: string): Promise<{
    status: 'verified' | 'pending' | 'failed' | 'inconclusive'
    reason?: string
    recommendedCNAME?: string
    fingerprint: string
  }> {
    try {
      // Call Vercel domains gateway to check DNS
      const response = await fetch(`https://api.vercel.com/v9/domains/${domain}/records`, {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        },
      })

      if (!response.ok) {
        // Inconclusive on transient failures - don't alter verified state
        return {
          status: 'inconclusive',
          reason: `Vercel API returned ${response.status}`,
          fingerprint: domain,
        }
      }

      const data = await response.json()
      // Parse DNS records and verify CNAME
      const cnameRecord = data.records?.find((r: any) => r.type === 'CNAME')
      
      if (!cnameRecord) {
        return {
          status: 'failed',
          reason: 'No CNAME record found',
          fingerprint: domain,
        }
      }

      // Verify the CNAME is correctly configured
      const isValid = this.verifyCNAME(cnameRecord.value)
      
      if (isValid) {
        return {
          status: 'verified',
          recommendedCNAME: cnameRecord.value,
          fingerprint: domain,
        }
      }

      return {
        status: 'pending',
        reason: 'CNAME validation failed',
        recommendedCNAME: cnameRecord.value,
        fingerprint: domain,
      }
    } catch (error) {
      // Inconclusive on transient API failures - preserves authoritative state
      return {
        status: 'inconclusive',
        reason: error instanceof Error ? error.message : 'Unknown error',
        fingerprint: domain,
      }
    }
  }

  async getAuditStatus(teamStudioDomainId: string): Promise<{
    dnsAuditStatus: 'verified' | 'pending' | 'failed' | 'inconclusive' | null
    dnsLastCheckedAt: Date | null
    dnsReasonCode: string | null
    dnsMisconfigured: boolean | null
    dnsFingerprint: string | null
  }> {
    // This would query the database for the audit status
    // Placeholder implementation
    return {
      dnsAuditStatus: null,
      dnsLastCheckedAt: null,
      dnsReasonCode: null,
      dnsMisconfigured: null,
      dnsFingerprint: null,
    }
  }

  async updateAuditStatus(
    teamStudioDomainId: string,
    status: 'verified' | 'pending' | 'failed' | 'inconclusive',
    reason?: string,
    recommendedCNAME?: string
  ): Promise<void> {
    // This would update the database
    // Placeholder implementation
  }

  private verifyCNAME(cname: string): boolean {
    // Implement CNAME validation logic
    // Check that the CNAME points to a Vercel deployment
    return cname.includes('.vercel.app') || cname.includes('.vercel.com')
  }
}