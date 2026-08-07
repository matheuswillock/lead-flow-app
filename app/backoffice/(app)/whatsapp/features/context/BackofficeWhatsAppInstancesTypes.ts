export type WhatsAppConnectionStatus =
  | "PENDING"
  | "INITIALIZING"
  | "QR_READY"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
  | "BANNED"

export interface BackofficeWhatsAppInstanceMaster {
  id: string
  fullName: string | null
  email: string | null
  supabaseId: string | null
}

export interface BackofficeWhatsAppInstanceTeam {
  id: string
  name: string
  master: BackofficeWhatsAppInstanceMaster
}

export interface BackofficeWhatsAppInstanceListItem {
  id: string
  teamId: string
  provider: string
  engine: string
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  displayName: string | null
  status: WhatsAppConnectionStatus
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  lastSyncAt: string | null
  historySyncStatus: string
  usageLimitMonthly: number
  billingEnabled: boolean
  createdAt: string
  updatedAt: string
  team: BackofficeWhatsAppInstanceTeam
}

export interface BackofficeWhatsAppUsage {
  periodKey: string
  usageLimitMonthly: number
  outboundCount: number
  inboundCount: number
  consumedPercentage: number
  status: "WITHIN_LIMIT" | "ATTENTION" | "EXCEEDED"
}

export interface BackofficeWhatsAppInstanceDetail extends BackofficeWhatsAppInstanceListItem {
  qrCodeText: string | null
  qrCodeImageUrl: string | null
  webhookUrl: string
  historySyncStartedAt: string | null
  historySyncCompletedAt: string | null
  historySyncError: string | null
  usage: BackofficeWhatsAppUsage
}

export interface BackofficeWhatsAppTeamWithoutInstance {
  id: string
  name: string
  master: BackofficeWhatsAppInstanceMaster
}

export interface BackofficeWhatsAppInstancesFilters {
  q: string
  status: WhatsAppConnectionStatus | "all"
  engine?: string | "all"
}

export interface BackofficeWhatsAppInstancesPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface UpdateWhatsAppInstanceFormData {
  usageLimitMonthly: number
  billingEnabled: boolean
}

export interface ProvisionWhatsAppInstanceFormData {
  teamId: string
  usageLimitMonthly?: number
}

export interface BackofficeWhatsAppWebhookResyncItem {
  configId: string
  teamId: string
  instanceName: string
  status: WhatsAppConnectionStatus
  webhookUrl: string
  ok: boolean
  error?: string
}

export interface BackofficeWhatsAppWebhookResyncResult {
  mode: "dry-run" | "apply"
  total: number
  ok: number
  failed: number
  results: BackofficeWhatsAppWebhookResyncItem[]
}
