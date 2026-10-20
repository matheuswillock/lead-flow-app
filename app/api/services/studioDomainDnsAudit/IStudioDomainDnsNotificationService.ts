export interface IStudioDomainDnsNotificationService {
  sendDnsFailureNotification(domain: string, status: string, reasonCode: string, recommendedCNAME?: string, fingerprint?: string): Promise<void>
  sendDnsRecoveryNotification(domain: string, previousStatus: string, currentStatus: string, fingerprint: string): Promise<void>
  isNotificationDuplicated(fingerprint: string, lastCheckedFingerprints: string[]): boolean
}