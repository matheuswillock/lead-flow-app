import type { Output } from "@/lib/output"

export type StudioDomainDnsAuditBatchSummary = {
  total: number
  verified: number
  pending: number
  failed: number
  inconclusive: number
  notified: number
  errors: number
}

export interface IStudioDomainDnsAuditUseCase {
  execute(): Promise<Output>
}
