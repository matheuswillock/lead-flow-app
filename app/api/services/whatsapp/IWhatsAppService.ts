export interface CreateWhatsAppConfigInput {
  teamId: string
  profileId: string
  usageLimitMonthly?: number
  hostBaseUrl?: string
}

export interface ConfigOutput {
  teamId: string
  provider: string
  status: string
  instanceName: string
  phoneNumber: string | null
  qrCodeImageUrl: string | null
  qrCodeText: string | null
  usageLimitMonthly: number
  lastConnectedAt: Date | null
  lastDisconnectedAt: Date | null
  lastSyncAt: Date | null
}

export interface SendMessageInput {
  conversationId: string
  teamId: string
  sentByProfileId: string
  contentText: string
}

export interface UsageSummaryOutput {
  periodKey: string
  usageLimitMonthly: number
  outboundCount: number
  inboundCount: number
  consumedPercentage: number
  status: "WITHIN_LIMIT" | "ATTENTION" | "EXCEEDED"
}

export interface IWhatsAppService {
  createConfig(input: CreateWhatsAppConfigInput): Promise<ConfigOutput>
  getConfig(teamId: string): Promise<ConfigOutput | null>
  reconnect(teamId: string, profileId: string): Promise<ConfigOutput>
  disconnect(teamId: string, profileId: string): Promise<ConfigOutput>
  sendMessage(input: SendMessageInput): Promise<{ messageId: string }>
  getUsageSummary(teamId: string): Promise<UsageSummaryOutput>
}
