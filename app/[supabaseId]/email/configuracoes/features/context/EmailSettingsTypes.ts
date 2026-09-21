export type BlockedDateRange =
  | { date: string }
  | { from: string; to: string }

export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | "partially_verified"
  | "partially_failed"

export type DomainRecord = {
  record?: string
  type: string
  name: string
  value: string
  ttl: string
  priority?: number
  status?: string
}

export type DomainEventType =
  | "domain_added"
  | "dns_verified"
  | "domain_verified"
  | "domain_deleted"
  | "domain_failed"

export type DomainEvent = {
  id: string
  type: DomainEventType
  occurredAt: string
  metadata: Record<string, unknown> | null
}

/**
 * Hospedagem de DNS do domínio, resolvida no servidor a partir dos nameservers
 * (`lib/email/dns-provider-map.ts`). `name` null = nameservers encontrados, mas
 * fora do mapa conhecido — a tela mostra os NS crus para o suporte seguir.
 * O campo inteiro ausente/null = a consulta DoH não respondeu.
 */
export type DomainDnsProvider = {
  name: string | null
  nameservers: string[]
}

export type DomainConnectResult = {
  domainId: string
  domainName: string
  status: ResendDomainStatus
  region?: string | null
  dnsProvider?: DomainDnsProvider | null
  connectedAt?: string | null
  openTracking?: boolean
  clickTracking?: boolean
  trackingSubdomain?: string | null
  records: DomainRecord[]
  events?: DomainEvent[]
}

/** Domínio próprio do time para servir formulários públicos (Frente C). */
export type FormDomainStatus = "pending" | "verified" | "failed"

export type FormDomain = {
  hostname: string
  status: FormDomainStatus
  verifiedAt: string | null
  lastCheckedAt: string | null
  createdAt: string
}

export type FormDomainResult = {
  formDomain: FormDomain | null
  records?: DomainRecord[]
}

export type FormDomainRecordsResult = {
  formDomain: FormDomain
  records: DomainRecord[]
}

export type EmailSender = {
  id: string
  name: string
  email: string
  replyTo: string | null
  isDefault: boolean
}

export type EmailVariableType = "string" | "number"
export type EmailVariableValueSource = "STATIC" | "RADAR"

export type EmailGlobalVariable = {
  id: string
  key: string
  type: EmailVariableType
  defaultValue: string | null
  description: string | null
  isActive: boolean
  valueSource: EmailVariableValueSource
  radarFieldKey: string | null
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
  templateApprovalRoles: string[]
  blockedDispatchDays: number[]
  resendDomainId: string | null
  resendDomainName: string | null
  resendDomainStatus: ResendDomainStatus | null
  resendDomainRegion: string | null
  resendDomainConnectedAt: string | null
  resendOpenTracking: boolean
  resendClickTracking: boolean
  resendDomainTrackingCapable: boolean
  resendDomainDispatchWarnings: string[]
  domainEvents: DomainEvent[]
  senders: EmailSender[]
  defaultSenderId: string | null
  globalVariables: EmailGlobalVariable[]
}
