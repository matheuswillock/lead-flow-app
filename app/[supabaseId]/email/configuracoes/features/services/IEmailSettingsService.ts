import type { BlockedDateRange, DomainConnectResult, DomainRecord, EmailSettings, ResendDomainStatus } from "../context/EmailSettingsTypes"

export type { EmailSettings, BlockedDateRange, DomainConnectResult, DomainRecord, ResendDomainStatus }

export interface UpdateEmailSettingsData {
  fromName?: string
  fromEmail?: string
  replyTo?: string | null
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
}

export interface IEmailSettingsService {
  get(): Promise<EmailSettings>
  update(data: UpdateEmailSettingsData): Promise<EmailSettings>
  connectDomain(domainName: string): Promise<DomainConnectResult>
  disconnectDomain(): Promise<void>
  verifyDomain(): Promise<{ status: ResendDomainStatus }>
  getDomainRecords(): Promise<DomainConnectResult>
}
