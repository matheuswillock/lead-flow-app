import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import type { Prisma } from "@prisma/client"

export interface CreateWhatsAppConfigInput {
  teamId: string
  profileId: string
  usageLimitMonthly?: number
  hostBaseUrl?: string
  reuseFromTeamId?: string
  callerIsMaster?: boolean
}

export interface ConfigOutput {
  teamId: string
  provider: string
  status: string
  instanceName: string
  phoneNumber: string | null
  normalizedPhone: string | null
  lastConnectedNormalizedPhone: string | null
  primaryConfigId: string | null
  qrCodeImageUrl: string | null
  qrCodeText: string | null
  usageLimitMonthly: number
  lastConnectedAt: Date | null
  lastDisconnectedAt: Date | null
  lastSyncAt: Date | null
  historySyncStatus: string
  historySyncStartedAt: Date | null
  historySyncCompletedAt: Date | null
  historySyncError: string | null
}

export interface SendMessageInput {
  conversationId: string
  teamId: string
  sentByProfileId: string
  contentText?: string
  mentionedJids?: string[]
  media?: {
    mediatype: "image" | "document" | "audio" | "video"
    mimeType: string
    fileName: string
    base64: string
    caption?: string
  }
}

export interface SendAutoResponseMessageInput {
  teamId: string
  conversationId: string
  contentText: string
  autoResponseRuleId: string
}

export interface CreateConversationInput {
  teamId: string
  profileId: string
  phone: string
  contactName?: string
  initialMessage?: string
}

export interface UsageSummaryOutput {
  periodKey: string
  usageLimitMonthly: number
  outboundCount: number
  inboundCount: number
  consumedPercentage: number
  status: "WITHIN_LIMIT" | "ATTENTION" | "EXCEEDED"
}

export interface SyncContactsOutput {
  imported: number
  updatedConversations: number
  totalContacts: number
}

export interface SyncGroupParticipantsOutput {
  imported: number
  totalParticipants: number
}

export interface WhatsAppContactOutput {
  id: string
  remoteJid: string
  opaqueId: string
  phoneNumber: string | null
  displayName: string | null
  pushName: string | null
  source: string
}

export interface IWhatsAppService {
  createConfig(input: CreateWhatsAppConfigInput): Promise<ConfigOutput>
  getConfig(teamId: string): Promise<ConfigOutput | null>
  reconnect(teamId: string, profileId: string): Promise<ConfigOutput>
  disconnect(teamId: string, profileId: string): Promise<ConfigOutput>
  sendMessage(input: SendMessageInput): Promise<{ messageId: string }>
  sendAutoResponseMessage(input: SendAutoResponseMessageInput): Promise<{ messageId: string }>
  createConversation(input: CreateConversationInput): Promise<WhatsAppConversationSelect>
  syncTeamHistory(teamId: string): Promise<{ chats: number; messages: number }>
  syncContacts(teamId: string, conversationId?: string): Promise<SyncContactsOutput>
  syncGroupParticipants(teamId: string, conversationId: string): Promise<SyncGroupParticipantsOutput>
  listContacts(
    teamId: string,
    params?: { q?: string; groupJid?: string; contactWhere?: Prisma.TeamWhatsAppContactWhereInput }
  ): Promise<WhatsAppContactOutput[]>
  getUsageSummary(teamId: string): Promise<UsageSummaryOutput>
}
