import type { StudioDomainDnsAuditResult } from "./StudioDomainDnsAuditTypes"

export type StudioDomainDnsNotificationInput = {
  domainId: string
  teamId: string
  result: StudioDomainDnsAuditResult
  lastCheckedAt: Date
}

export interface IStudioDomainDnsNotificationService {
  notify(input: StudioDomainDnsNotificationInput): Promise<void>
}
