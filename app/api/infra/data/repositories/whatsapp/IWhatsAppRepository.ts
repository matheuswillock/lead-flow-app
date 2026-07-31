import type { Prisma, WhatsAppMessageStatus } from "@prisma/client"

export interface WhatsAppConfigSelect {
  id: string
  teamId: string
  provider: string
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  normalizedPhone: string | null
  lastConnectedNormalizedPhone: string | null
  primaryConfigId: string | null
  displayName: string | null
  status: string
  qrCodeText: string | null
  qrCodeImageUrl: string | null
  webhookSecret: string
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
  contactId?: string | null
  contactPhone: string
  contactName: string | null
  contactNameSource: string
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
  deletedAt: Date | null
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
  clientMessageId: string | null
  direction: string
  messageType: string
  status: string
  contentText: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaFileName: string | null
  storagePath: string | null
  mediaSha256: string | null
  mediaSizeBytes: number | null
  mediaStatus: string | null
  mediaAttemptCount: number
  mediaLastErrorCode: string | null
  mediaRetrievedAt: Date | null
  linkPreview: Prisma.JsonValue | null
  caption: string | null
  senderDisplayName: string | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  playedAt: Date | null
  failedAt: Date | null
  isAutoResponse: boolean
  autoResponseRuleId: string | null
  quotedMessageId: string | null
  quotedProviderMessageId: string | null
  deletedForEveryoneAt: Date | null
  deletedByProfileId: string | null
  createdAt: Date
}

export interface WhatsAppInboundReadReceiptCandidate {
  id: string
  providerMessageId: string | null
  rawPayload: Prisma.JsonValue
}

export type WhatsAppOutboundCommandStatus = "PENDING" | "SENT" | "UNKNOWN" | "FAILED"
export type WhatsAppWebhookEventStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "DEAD_LETTER"

export interface WhatsAppOutboundCommandRecord {
  conversationId: string
  messageId: string | null
  status: WhatsAppOutboundCommandStatus
  requestHash: string | null
}

export interface WhatsAppWebhookOutboxEvent {
  id: string
  teamId: string
  configId: string
  payload: Prisma.JsonValue
  attemptCount: number
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

  /**
   * Remove conversas/mensagens/contatos do time e reseta o history sync
   * quando um número diferente assume a mesma config (após disconnect + novo QR).
   */
  resetInboxForConfigChange(configId: string, teamId: string): Promise<void>

  incrementWebhookConsecutiveFailures(configId: string): Promise<{
    webhookConsecutiveFailures: number
    instanceName: string
    phoneNumber: string | null
    status: string
  }>

  resetWebhookConsecutiveFailures(configId: string): Promise<void>

  // Conversations
  findOrCreateConversation(params: {
    teamId: string
    configId: string
    externalChatId: string
    contactPhone: string
    normalizedPhone: string
    contactName?: string
    contactId?: string
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
  searchConversations(
    teamId: string,
    query: string,
    limit: number,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<WhatsAppConversationSelect[]>
  findConversationByContactId(
    teamId: string,
    contactId: string,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<WhatsAppConversationSelect | null>

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
      playedAt?: Date
      failedAt?: Date
    }
  ): Promise<WhatsAppMessageSelect>

  markMessageDeletedForEveryone(id: string, deletedByProfileId?: string | null): Promise<void>

  upsertMessageReaction(params: {
    teamId: string
    messageId: string
    actorPhone: string
    emoji: string
    profileId?: string | null
    removedAt?: Date | null
  }): Promise<void>

  findMessageIdByStoragePath(storagePath: string): Promise<string | null>

  claimMediaIngestBatch(limit?: number): Promise<Array<{
    id: string
    teamId: string
    conversationId: string
    configId: string
    mediaUrl: string | null
    mediaMimeType: string | null
    mediaFileName: string | null
    mediaAttemptCount: number
    rawPayload: Prisma.JsonValue
    providerMessageId: string | null
  }>>

  markMediaIngestResult(input: {
    messageId: string
    status: "AVAILABLE" | "EXPIRED" | "FAILED" | "PROCESSING"
    storagePath?: string | null
    mediaSha256?: string | null
    mediaSizeBytes?: number | null
    errorCode?: string | null
    mediaRetrievedAt?: Date | null
  }): Promise<void>

  listMessages(params: {
    conversationId: string
    profileId?: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }>

  listInboundPendingReadReceipt(
    conversationId: string,
    limit?: number
  ): Promise<WhatsAppInboundReadReceiptCandidate[]>

  bulkSetInboundBrokerReadAt(messageIds: string[], readAt: Date): Promise<number>

  // Durable delivery and webhook outbox
  findOutboundCommand(teamId: string, clientMessageId: string): Promise<WhatsAppOutboundCommandRecord | null>
  createOutboundCommand(input: { teamId: string; conversationId: string; clientMessageId: string }): Promise<boolean>
  createPendingOutboundMessageAndCommand(input: {
    teamId: string
    conversationId: string
    clientMessageId: string
    requestHash: string
    sentByProfileId: string
    contentText?: string
    messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO"
    mediaMimeType?: string
    mediaFileName?: string
    caption?: string
    storagePath?: string
    mediaSha256?: string
    mediaSizeBytes?: number
    quotedMessageId?: string
    quotedProviderMessageId?: string
  }): Promise<{
    created: boolean
    messageId: string | null
    conversationId: string | null
    requestHash: string | null
  }>
  retryFailedOutboundCommand(input: {
    teamId: string
    clientMessageId: string
    requestHash: string
  }): Promise<{ messageId: string | null; claimed: boolean }>
  confirmOutboundMessage(input: {
    messageId: string
    providerMessageId: string
    rawPayload: Prisma.InputJsonValue
    storagePath?: string | null
    mediaSha256?: string | null
    mediaSizeBytes?: number | null
    sentAt: Date
  }): Promise<WhatsAppMessageSelect>
  completeOutboundCommand(input: { teamId: string; clientMessageId: string; messageId: string }): Promise<void>
  failOutboundCommand(input: { teamId: string; clientMessageId: string; status: "UNKNOWN" | "FAILED"; error: string }): Promise<void>
  persistWebhookEvent(input: { configId: string; teamId: string; providerEventId: string; eventType: string; payload: Prisma.InputJsonValue }): Promise<string>
  claimWebhookEvent(eventId: string): Promise<WhatsAppWebhookOutboxEvent | null>
  completeWebhookEvent(input: {
    eventId: string
    expectedAttemptCount: number
    status: "PROCESSED" | "PENDING" | "DEAD_LETTER"
    error?: string
    nextAttemptAt?: Date | null
  }): Promise<void>
  listPendingWebhookEventIds(limit: number): Promise<string[]>
  requeueDeadLetterEvent(input: { eventId: string; teamId: string; actorProfileId: string }): Promise<boolean>
  reconcileStaleOutboundCommands(now?: Date): Promise<number>
  listConnectedContactSyncTargets(): Promise<Array<{ teamId: string; configId: string }>>
  enqueueContactSyncJob(input: { teamId: string; configId: string }): Promise<string>
  claimNextContactSyncJob(workerId: string): Promise<{ id: string; teamId: string; configId: string; checkpoint: unknown } | null>
  renewContactSyncJobLease(input: { jobId: string; workerId: string; checkpoint: unknown }): Promise<void>
  parkContactSyncJob(input: { jobId: string; checkpoint: unknown }): Promise<void>
  completeContactSyncJob(input: { jobId: string; error?: string }): Promise<void>

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

  softDeleteConversation(id: string): Promise<void>
  softDeleteConversationWithAudit(input: {
    conversationId: string
    teamId: string
    actorProfileId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }): Promise<void>
  deleteConversation(id: string): Promise<void>
  createAuditEvent(input: {
    teamId: string
    conversationId?: string | null
    actorProfileId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }): Promise<void>

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

  // Message actions (Phase 4)
  getMessageActionsState(input: {
    teamId: string
    messageId: string
    profileId: string
  }): Promise<{
    messageId: string
    conversationId: string
    isFavorite: boolean
    isPinned: boolean
    isHidden: boolean
    reactions: Array<{ emoji: string; profileId: string | null; removedAt: Date | null }>
    deletedForEveryoneAt: Date | null
  } | null>

  upsertMessageFavorite(input: { teamId: string; messageId: string; profileId: string }): Promise<void>
  removeMessageFavorite(input: { teamId: string; messageId: string; profileId: string }): Promise<void>
  pinMessage(input: {
    teamId: string
    conversationId: string
    messageId: string
    pinnedByProfileId: string
    expiresAt?: Date | null
  }): Promise<void>
  unpinMessage(input: { teamId: string; messageId: string }): Promise<void>
  hideMessageForProfile(input: { teamId: string; messageId: string; profileId: string }): Promise<void>
  findActionCommand(input: {
    teamId: string
    clientActionId: string
  }): Promise<{
    id: string
    messageId: string
    kind: string
    status: string
    requestHash: string | null
  } | null>
  createActionCommand(input: {
    teamId: string
    messageId: string
    profileId: string
    clientActionId: string
    kind: "REACT" | "UNREACT" | "DELETE_FOR_EVERYONE"
    requestHash: string
    emoji?: string | null
  }): Promise<{ created: boolean; id: string; status: string }>

  searchMessagesInConversation(input: {
    teamId: string
    conversationId: string
    profileId: string
    query: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }>

  mergeMessageRawPayload(
    messageId: string,
    patch: Record<string, unknown>
  ): Promise<void>

  softDeleteAllTeamConversationsWithAudit(input: {
    teamId: string
    actorProfileId: string
  }): Promise<number>

  requeueAllDeadLetterEvents(input: {
    teamId: string
    actorProfileId: string
  }): Promise<number>

  getTeamOpsMetrics(teamId: string): Promise<{
    deadLetterCount: number
    pendingWebhookCount: number
    unknownOutboundCount: number
    failedMediaCount: number
    pendingActionCommandCount: number
    unknownActionCommandCount: number
  }>
}
