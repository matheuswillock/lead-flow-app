export type WhatsAppConnectionStatus = 'PENDING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'BANNED'

export interface WhatsAppConfig {
  teamId: string
  provider: string
  status: WhatsAppConnectionStatus
  instanceName: string
  phoneNumber: string | null
  qrCodeImageUrl: string | null
  qrCodeText: string | null
  usageLimitMonthly: number
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  lastSyncAt: string | null
}

export interface WhatsAppUsage {
  periodKey: string
  usageLimitMonthly: number
  outboundCount: number
  inboundCount: number
  consumedPercentage: number
  status: 'WITHIN_LIMIT' | 'ATTENTION' | 'EXCEEDED'
}

export interface WhatsAppSettingsState {
  config: WhatsAppConfig | null
  usage: WhatsAppUsage | null
  isLoading: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnecting: boolean
}

export interface WhatsAppSettingsActions {
  connect: () => Promise<void>
  reconnect: () => Promise<void>
  disconnect: () => Promise<void>
  reload: () => void
}

export type WhatsAppSettingsContextValue = WhatsAppSettingsState & WhatsAppSettingsActions
