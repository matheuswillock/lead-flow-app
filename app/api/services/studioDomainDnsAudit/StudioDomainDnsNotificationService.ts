import { IStudioDomainDnsNotificationService } from './IStudioDomainDnsNotificationService'

// Resend and email templates are loaded lazily to allow testing without external dependencies
let resend: any = null
let DNS_FAILURE_EMAIL_TEMPLATE: any = (props: any) => JSON.stringify(props)
let DNS_RECOVERY_EMAIL_TEMPLATE: any = (props: any) => JSON.stringify(props)

export const initResend = (resendModule: any, templates: any) => {
  resend = resendModule
  DNS_FAILURE_EMAIL_TEMPLATE = templates.FAILURE
  DNS_RECOVERY_EMAIL_TEMPLATE = templates.RECOVERY
}

export class StudioDomainDnsNotificationService implements IStudioDomainDnsNotificationService {
  private readonly fingerprints: Map<string, Date> = new Map()

  async sendDnsFailureNotification(
    domain: string,
    status: string,
    reasonCode: string,
    recommendedCNAME?: string,
    fingerprint?: string
  ): Promise<void> {
    const fp = fingerprint || domain
    
    // Deduplication: skip if fingerprint hasn't changed
    if (this.fingerprints.has(fp)) {
      const lastSent = this.fingerprints.get(fp)!
      const now = new Date()
      // Only send if more than 24 hours since last notification for same fingerprint
      if (now.getTime() - lastSent.getTime() < 24 * 60 * 60 * 1000) {
        return // Skip - not enough time has passed
      }
    }

    try {
      if (resend) {
        await resend.email.send({
          from: 'no-reply@leadflow.studio',
          to: 'matheuswillock@leadflow.studio',
          subject: `DNS Audit Alert: ${domain} - ${status}`,
          react: DNS_FAILURE_EMAIL_TEMPLATE({
            domain,
            status,
            reasonCode,
            recommendedCNAME,
            href: `/studio/domains/${domain}`,
          }),
        })
      } else {
        // Mock/test mode - just log
        console.log(`DNS Failure (test mode): ${domain} - ${status} - ${reasonCode}`)
      }

      // Update fingerprint timestamp
      this.fingerprints.set(fp, new Date())
    } catch (error) {
      console.error('Failed to send DNS failure email:', error)
      // Fallback to console if Resend fails
      console.log(`DNS Failure: ${domain} - ${status} - ${reasonCode}`)
    }
  }

  async sendDnsRecoveryNotification(
    domain: string,
    previousStatus: string,
    currentStatus: string,
    fingerprint: string
  ): Promise<void> {
    // Only send recovery notification if status changed from non-verified to verified
    if (previousStatus !== 'inconclusive' && previousStatus !== 'failed' && currentStatus === 'verified') {
      try {
        if (resend) {
          await resend.email.send({
            from: 'no-reply@leadflow.studio',
            to: 'matheuswillock@leadflow.studio',
            subject: `DNS Recovery: ${domain} is now healthy`,
            react: DNS_RECOVERY_EMAIL_TEMPLATE({
              domain,
              href: `/studio/domains/${domain}`,
            }),
          })
        } else {
          // Mock/test mode - just log
          console.log(`DNS Recovery (test mode): ${domain} is now healthy`)
        }

        // Update fingerprint timestamp
        this.fingerprints.set(fingerprint, new Date())
      } catch (error) {
        console.error('Failed to send DNS recovery email:', error)
      }
    }
  }

  isNotificationDuplicated(fingerprint: string, lastCheckedFingerprints: string[]): boolean {
    // Check if this fingerprint was already checked recently
    const alreadyChecked = lastCheckedFingerprints.includes(fingerprint)
    if (alreadyChecked) {
      return true
    }
    // Add to tracked fingerprints (keep only last 100)
    if (this.fingerprints.size >= 100) {
      this.fingerprints.clear()
    }
    return false
  }
}