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

export interface IWhatsAppIntegrationService {
  fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null>
  createConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  reconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  disconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  fetchUsage(teamId: string, supabaseId: string): Promise<WhatsAppUsage | null>
}
