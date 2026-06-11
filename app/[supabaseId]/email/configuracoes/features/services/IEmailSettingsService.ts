import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailSender,
  EmailSettings,
  ResendDomainStatus,
} from "../context/EmailSettingsTypes"

export type { EmailSettings, BlockedDateRange, DomainConnectResult, DomainRecord, EmailSender, ResendDomainStatus }

export interface UpdateEmailSettingsData {
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
}

export interface UpsertEmailSenderData {
  name: string
  email: string
  replyTo?: string | null
}

export interface IEmailSettingsService {
  get(): Promise<EmailSettings>
  update(data: UpdateEmailSettingsData): Promise<EmailSettings>
  getSenders(): Promise<EmailSender[]>
  createSender(data: UpsertEmailSenderData): Promise<EmailSender>
  updateSender(senderId: string, data: UpsertEmailSenderData): Promise<EmailSender>
  deleteSender(senderId: string): Promise<void>
  setDefaultSender(senderId: string): Promise<EmailSettings>
  connectDomain(domainName: string): Promise<DomainConnectResult>
  disconnectDomain(): Promise<void>
  verifyDomain(): Promise<{ status: ResendDomainStatus }>
  getDomainRecords(): Promise<DomainConnectResult>
}
