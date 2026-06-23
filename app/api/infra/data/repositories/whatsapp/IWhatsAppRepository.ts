import type { Prisma, WhatsAppMessageStatus } from "@prisma/client"

export interface WhatsAppConfigSelect {
  id: string
  teamId: string
  provider: string
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  displayName: string | null
  status: string
  qrCodeText: string | null
  qrCodeImageUrl: string | null
  webhookSecret: string
  hostBaseUrl: string | null
  lastConnectedAt: Date | null
  lastDisconnectedAt: Date | null
  lastSyncAt: Date | null
  usageLimitMonthly: number
  billingEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WhatsAppConversationSelect {
  id: string
  teamId: string
  configId: string
  leadId: string | null
  externalChatId: string | null
  contactPhone: string
  contactName: string | null
  normalizedPhone: string
  assignedProfileId: string | null
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WhatsAppMessageSelect {
  id: string
  conversationId: string
  teamId: string
  configId: string
  leadId: string | null
  providerMessageId: string | null
  direction: string
  messageType: string
  status: string
  contentText: string | null
  mediaUrl: string | null
  caption: string | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  failedAt: Date | null
  createdAt: Date
}

export interface IWhatsAppRepository {
  // Config
  findConfigByTeamId(teamId: string): Promise<WhatsAppConfigSelect | null>
  findConfigByWebhookSecret(secret: string): Promise<WhatsAppConfigSelect | null>
  findConfigById(id: string): Promise<WhatsAppConfigSelect | null>
  createConfig(data: Prisma.TeamWhatsAppConfigCreateInput): Promise<WhatsAppConfigSelect>
  updateConfig(id: string, data: Prisma.TeamWhatsAppConfigUpdateInput): Promise<WhatsAppConfigSelect>
  deleteConfig(id: string): Promise<void>

  // Conversations
  findOrCreateConversation(params: {
    teamId: string
    configId: string
    externalChatId: string
    contactPhone: string
    normalizedPhone: string
    contactName?: string
  }): Promise<WhatsAppConversationSelect>

  listConversations(params: {
    teamId: string
    leadId?: string
    assignedProfileId?: string
    hasUnread?: boolean
    isArchived?: boolean
    search?: string
    page?: number
    limit?: number
  }): Promise<{ conversations: WhatsAppConversationSelect[]; total: number }>

  updateConversation(
    id: string,
    data: Prisma.WhatsAppConversationUpdateInput
  ): Promise<WhatsAppConversationSelect>

  findConversationById(id: string): Promise<WhatsAppConversationSelect | null>

  linkConversationToLead(
    conversationId: string,
    leadId: string
  ): Promise<WhatsAppConversationSelect>

  // Messages
  createMessage(data: Prisma.WhatsAppMessageCreateInput): Promise<WhatsAppMessageSelect>

  findMessageByProviderMessageId(
    teamId: string,
    providerMessageId: string
  ): Promise<WhatsAppMessageSelect | null>

  updateMessageStatus(
    id: string,
    data: {
      status: WhatsAppMessageStatus
      deliveredAt?: Date
      readAt?: Date
      failedAt?: Date
    }
  ): Promise<WhatsAppMessageSelect>

  listMessages(params: {
    conversationId: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }>

  // Usage
  createUsageEvent(data: Prisma.WhatsAppUsageEventCreateInput): Promise<{ id: string }>

  getUsageSummary(params: {
    teamId: string
    periodKey: string
  }): Promise<{ outboundCount: number; inboundCount: number }>
}
