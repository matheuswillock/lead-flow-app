export type WhatsAppConnectionStatus = 'PENDING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'BANNED'

export type WhatsAppHistorySyncStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface WhatsAppConfig {
  teamId: string
  provider: string
  status: WhatsAppConnectionStatus
  instanceName: string
  phoneNumber: string | null
  normalizedPhone?: string | null
  lastConnectedNormalizedPhone?: string | null
  primaryConfigId?: string | null
  qrCodeImageUrl: string | null
  qrCodeText: string | null
  usageLimitMonthly: number
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  lastSyncAt: string | null
  historySyncStatus: WhatsAppHistorySyncStatus
  historySyncStartedAt: string | null
  historySyncCompletedAt: string | null
  historySyncError: string | null
}

export interface WhatsAppUsage {
  periodKey: string
  usageLimitMonthly: number
  outboundCount: number
  inboundCount: number
  consumedPercentage: number
  status: 'WITHIN_LIMIT' | 'ATTENTION' | 'EXCEEDED'
}

export interface ReusableWhatsAppNumber {
  teamId: string
  teamName: string
  phoneNumber: string
  configId: string
}

export interface WhatsAppSettingsState {
  config: WhatsAppConfig | null
  usage: WhatsAppUsage | null
  reusableNumbers: ReusableWhatsAppNumber[]
  isLoading: boolean
  isLoadingReusableNumbers: boolean
  isRefreshing: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnecting: boolean
  isSyncingContacts: boolean
}

export interface WhatsAppSettingsActions {
  connect: (reuseFromTeamId?: string) => Promise<void>
  reconnect: () => Promise<void>
  disconnect: () => Promise<void>
  reload: () => void
  syncPhoneContacts: () => Promise<void>
}

export type WhatsAppSettingsContextValue = WhatsAppSettingsState & WhatsAppSettingsActions
