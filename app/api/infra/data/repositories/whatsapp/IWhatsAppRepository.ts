import type { Prisma, WhatsAppMessageStatus } from "@prisma/client"

export interface WhatsAppConfigSelect {
  id: string
  teamId: string
  provider: string
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  normalizedPhone: string | null
  primaryConfigId: string | null
  displayName: string | null
  status: string
  qrCodeText: string | null
  qrCodeImageUrl: string | null
  webhookSecret: string
  hostBaseUrl: string | null
  lastConnectedAt: Date | null
  lastDisconnectedAt: Date | null
  lastSyncAt: Date | null
  historySyncStatus: string
  historySyncStartedAt: Date | null
  historySyncCompletedAt: Date | null
  historySyncError: string | null
  usageLimitMonthly: number
  billingEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WhatsAppConversationTagSummary {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface WhatsAppConversationSelect {
  id: string
  teamId: string
  configId: string
  leadId: string | null
  externalChatId: string | null
  contactPhone: string
  contactName: string | null
  contactAvatarUrl: string | null
  normalizedPhone: string
  assignedProfileId: string | null
  createdByProfileId: string | null
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
  handoffMode: string
  welcomeSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type WhatsAppConversationWithTagsSelect = WhatsAppConversationSelect & {
  tagAssignments: Array<{ tag: WhatsAppConversationTagSummary }>
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
  mediaMimeType: string | null
  mediaFileName: string | null
  linkPreview: Prisma.JsonValue | null
  caption: string | null
  senderDisplayName: string | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  failedAt: Date | null
  isAutoResponse: boolean
  autoResponseRuleId: string | null
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

  /**
   * Reivindica atomicamente o slot de sincronização de histórico via
   * updateMany condicional (historySyncStatus fora de RUNNING/COMPLETED).
   * Retorna true apenas para o chamador que efetivamente iniciou o sync,
   * eliminando a corrida leitura-depois-escrita do guard em memória.
   */
  claimHistorySyncSlot(configId: string): Promise<boolean>

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
    tagIds?: string[]
    page?: number
    limit?: number
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{ conversations: (WhatsAppConversationSelect & { tags: WhatsAppConversationTagSummary[] })[]; total: number }>

  getUnreadTotals(params: {
    teamId: string
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{ totalMessages: number; totalConversations: number }>

  updateConversation(
    id: string,
    data: Prisma.WhatsAppConversationUpdateInput
  ): Promise<WhatsAppConversationSelect>

  findConversationById(id: string): Promise<WhatsAppConversationSelect | null>

  /**
   * Tenta reivindicar atomicamente o envio da mensagem de boas-vindas de uma
   * conversa (compare-and-swap em welcomeSentAt). Retorna true apenas para o
   * chamador que efetivamente marcou o campo, evitando duas respostas WELCOME
   * quando mensagens inbound concorrentes disparam a mesma regra.
   */
  claimWelcomeSlot(conversationId: string): Promise<boolean>

  linkConversationToLead(
    conversationId: string,
    leadId: string
  ): Promise<WhatsAppConversationSelect>

  linkConversationToLeadIfEmpty(
    conversationId: string,
    leadId: string
  ): Promise<WhatsAppConversationSelect | null>

  // Messages
  createMessage(data: Prisma.WhatsAppMessageCreateInput): Promise<WhatsAppMessageSelect>

  findMessageByProviderMessageId(
    teamId: string,
    providerMessageId: string
  ): Promise<WhatsAppMessageSelect | null>

  findMessageByIdForTeam(
    teamId: string,
    messageId: string
  ): Promise<(WhatsAppMessageSelect & { rawPayload: Prisma.JsonValue }) | null>

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

  listMessagesSince(params: {
    teamId: string
    since: Date
  }): Promise<WhatsAppMessageSelect[]>

  listConversationsForTeam(teamId: string): Promise<WhatsAppConversationSelect[]>

  findTeamMasterContext(teamId: string): Promise<{ masterId: string; timezone: string | null } | null>

  findConnectedConfigByNormalizedPhone(
    normalizedPhone: string,
    excludeConfigId?: string
  ): Promise<{ id: string; teamId: string; masterId: string; primaryConfigId: string | null } | null>

  findMirroredConfigs(primaryConfigId: string): Promise<WhatsAppConfigSelect[]>

  findConfigByInstanceName(instanceName: string): Promise<WhatsAppConfigSelect | null>

  resolveEffectiveConfig(config: WhatsAppConfigSelect): Promise<WhatsAppConfigSelect>

  findLeadTeamIdByPhoneForMaster(
    masterId: string,
    normalizedPhone: string,
    fallbackTeamId: string
  ): Promise<string>

  listConnectedConfigsForMaster(
    masterId: string
  ): Promise<Array<WhatsAppConfigSelect & { teamName: string }>>

  getOperatorProfileIdsForTeam(teamId: string): Promise<string[]>

  getOperatorLeadPhones(teamId: string, profileId: string): Promise<string[]>

  countConversationsWithVisibility(
    conversationId: string,
    teamId: string,
    visibilityWhere: Prisma.WhatsAppConversationWhereInput
  ): Promise<number>

  findConversationByIdForTeam(
    conversationId: string,
    teamId: string
  ): Promise<WhatsAppConversationSelect | null>

  listConversationContactKeysForTeam(
    teamId: string,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<Array<{ normalizedPhone: string; externalChatId: string | null }>>

  findConversationByExternalChatId(
    teamId: string,
    externalChatId: string
  ): Promise<WhatsAppConversationSelect | null>

  findConversationsByExternalChatIds(
    teamId: string,
    externalChatIds: string[]
  ): Promise<WhatsAppConversationSelect[]>
}
