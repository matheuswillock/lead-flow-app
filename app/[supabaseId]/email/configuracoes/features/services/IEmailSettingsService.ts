import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  EmailVariableType,
  EmailVariableValueSource,
  FormDomain,
  FormDomainRecordsResult,
  FormDomainResult,
  FormDomainStatus,
  ResendDomainStatus,
} from "../context/EmailSettingsTypes"

export type {
  EmailSettings,
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailSender,
  EmailGlobalVariable,
  ResendDomainStatus,
  FormDomain,
  FormDomainResult,
  FormDomainRecordsResult,
  FormDomainStatus,
}

export interface UpsertEmailVariableData {
  key: string
  type?: EmailVariableType
  defaultValue?: string | null
  description?: string | null
  isActive?: boolean
  valueSource?: EmailVariableValueSource
  radarFieldKey?: string | null
}

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

export interface ConfigureDomainTrackingData {
  trackingSubdomain: string
  openTracking: boolean
  clickTracking: boolean
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
  configureDomainTracking(data: ConfigureDomainTrackingData): Promise<DomainConnectResult>
  sendDomainDnsInstructions(recipientEmail: string): Promise<void>
  getFormDomain(): Promise<FormDomainResult>
  connectFormDomain(hostname: string): Promise<FormDomainResult>
  disconnectFormDomain(): Promise<void>
  verifyFormDomain(): Promise<FormDomainResult>
  getFormDomainRecords(): Promise<FormDomainRecordsResult>
  sendFormDomainDnsInstructions(recipientEmail: string): Promise<void>
  getVariables(): Promise<EmailGlobalVariable[]>
  createVariable(data: UpsertEmailVariableData): Promise<EmailGlobalVariable>
  updateVariable(variableId: string, data: UpsertEmailVariableData): Promise<EmailGlobalVariable>
  deleteVariable(variableId: string): Promise<void>
}
