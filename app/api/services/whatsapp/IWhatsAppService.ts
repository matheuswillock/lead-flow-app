import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import type { Prisma } from "@prisma/client"

export interface CreateWhatsAppConfigInput {
  teamId: string
  profileId: string
  usageLimitMonthly?: number
  reuseFromTeamId?: string
  callerIsMaster?: boolean
}

export interface ConfigOutput {
  teamId: string
  provider: string
  engine: string
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
  /** Existing durable bubble created with the outbox command. */
  pendingMessageId?: string
  clientMessageId?: string
  contentText?: string
  mentionedJids?: string[]
  quotedMessageId?: string
  quotedProviderMessageId?: string
  quotedFromMe?: boolean
  media?: {
    mediatype: "image" | "document" | "audio" | "video"
    mimeType: string
    fileName: string
    storagePath: string
    sha256: string
    sizeBytes: number
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
  phone?: string
  contactName?: string
  contactId?: string
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
  checkpoint?: {
    offset: number
    imported: number
    done: boolean
  }
}

export interface SyncContactsOptions {
  checkpoint?: { offset?: number; imported?: number }
  batchSize?: number
  timeBudgetMs?: number
  onProgress?: (checkpoint: { offset: number; imported: number; done: boolean }) => Promise<void>
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

export interface CanonicalWhatsAppContactOutput {
  id: string
  name: string | null
  phoneE164: string | null
  formattedPhone: string | null
  syncState: "FRESH" | "STALE" | "UNRESOLVED" | "CONFLICT"
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
  syncContacts(
    teamId: string,
    conversationId?: string,
    options?: SyncContactsOptions
  ): Promise<SyncContactsOutput>
  syncGroupParticipants(teamId: string, conversationId: string): Promise<SyncGroupParticipantsOutput>
  listContacts(
    teamId: string,
    params?: { q?: string; groupJid?: string; contactWhere?: Prisma.TeamWhatsAppContactWhereInput }
  ): Promise<WhatsAppContactOutput[]>
  createOrGetContact(input: { teamId: string; phone: string; name?: string }): Promise<CanonicalWhatsAppContactOutput>
  updateContact(input: { teamId: string; contactId: string; phone?: string; name?: string | null }): Promise<CanonicalWhatsAppContactOutput>
  searchContacts(teamId: string, query: string): Promise<CanonicalWhatsAppContactOutput[]>
  searchInbox(teamId: string, query: string, limit?: number, visibility?: {
    contactWhere?: Prisma.TeamWhatsAppContactWhereInput
    conversationWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{
    conversations: WhatsAppConversationSelect[]
    contacts: Array<CanonicalWhatsAppContactOutput & { existingConversationId: string | null; isProvisional: boolean }>
    startNumber: { normalizedPhone: string; displayPhone: string } | null
  }>
  getUsageSummary(teamId: string): Promise<UsageSummaryOutput>
}
