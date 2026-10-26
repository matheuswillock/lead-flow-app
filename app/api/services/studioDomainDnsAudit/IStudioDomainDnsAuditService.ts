import type { StudioDomainDnsAuditResult } from "./StudioDomainDnsAuditTypes"

export interface IStudioDomainDnsAuditService {
  audit(hostname: string): Promise<StudioDomainDnsAuditResult>
}
