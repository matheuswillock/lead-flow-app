export type BlockedDateRange =
  | { date: string }
  | { from: string; to: string }

export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"

export type DomainRecord = {
  type: string
  name: string
  value: string
  ttl: string
  priority?: number
  status?: string
}

export type DomainConnectResult = {
  domainId: string
  domainName: string
  status: ResendDomainStatus
  records: DomainRecord[]
}

export type EmailSettings = {
  fromName: string
  fromEmail: string
  replyTo: string | null
  dispatchBlockedDates: BlockedDateRange[] | null
  dispatchTimeFrom: string | null
  dispatchTimeTo: string | null
  dispatchAllowedRoles: string[]
  templateCreateRoles: string[]
  templateApprovalRequired: boolean
  resendDomainId: string | null
  resendDomainName: string | null
  resendDomainStatus: ResendDomainStatus | null
}
