export type EmailLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"

export type EmailEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "delivery_delayed"
  | "unsubscribed"

export type EmailLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string
  status: EmailLogStatus
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  complainedAt: string | null
  campaignId: string | null
  campaign?: { id: string; name: string } | null
}

export type EmailEvent = {
  id: string
  type: EmailEventType
  occurredAt: string
  metadata: Record<string, string> | null
}

export type LogDetail = EmailLog & { events: EmailEvent[] }

export type HistoricoState = {
  logs: EmailLog[]
  total: number
  page: number
  totalPages: number
  search: string
  statusFilter: string
  dateFrom: string
  dateTo: string
  loading: boolean
  selectedLogId: string | null
  selectedLog: LogDetail | null
  loadingDetail: boolean
}
