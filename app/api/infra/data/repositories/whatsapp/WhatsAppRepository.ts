import { Prisma, type WhatsAppMessageStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { normalizePhone } from "@/lib/whatsapp/normalize-phone"
import {
  mapTagAssignmentsToSummaries,
  WHATSAPP_CONVERSATION_TAG_ASSIGNMENTS_SELECT,
} from "./WhatsAppConversationTagRepository"
import type {
  IWhatsAppRepository,
  WhatsAppConfigSelect,
  WhatsAppConversationSelect,
  WhatsAppConversationWithTagsSelect,
  WhatsAppMessageSelect,
  WhatsAppOutboundCommandRecord,
  WhatsAppWebhookOutboxEvent,
} from "./IWhatsAppRepository"

const CONFIG_SELECT = {
  id: true,
  teamId: true,
  provider: true,
  instanceName: true,
  instanceId: true,
  phoneNumber: true,
  normalizedPhone: true,
  lastConnectedNormalizedPhone: true,
  primaryConfigId: true,
  displayName: true,
  status: true,
  qrCodeText: true,
  qrCodeImageUrl: true,
  webhookSecret: true,
  lastConnectedAt: true,
  lastDisconnectedAt: true,
  lastSyncAt: true,
  historySyncStatus: true,
  historySyncStartedAt: true,
  historySyncCompletedAt: true,
  historySyncError: true,
  usageLimitMonthly: true,
  billingEnabled: true,
  webhookConsecutiveFailures: true,
  createdAt: true,
  updatedAt: true,
} as const

const CONVERSATION_SELECT = {
  id: true,
  teamId: true,
  configId: true,
  leadId: true,
  externalChatId: true,
  contactId: true,
  contactPhone: true,
  contactName: true,
  contactNameSource: true,
  contactAvatarUrl: true,
  normalizedPhone: true,
  assignedProfileId: true,
  createdByProfileId: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  unreadCount: true,
  isArchived: true,
  handoffMode: true,
  welcomeSentAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

const CONVERSATION_LIST_SELECT = {
  ...CONVERSATION_SELECT,
  ...WHATSAPP_CONVERSATION_TAG_ASSIGNMENTS_SELECT,
} as const

function mapConversationWithTags(
  conversation: WhatsAppConversationWithTagsSelect
): WhatsAppConversationSelect & { tags: ReturnType<typeof mapTagAssignmentsToSummaries> } {
  const { tagAssignments, ...base } = conversation
  return {
    ...base,
    tags: mapTagAssignmentsToSummaries(tagAssignments),
  }
}

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  teamId: true,
  configId: true,
  leadId: true,
  providerMessageId: true,
  clientMessageId: true,
  direction: true,
  messageType: true,
  status: true,
  contentText: true,
  mediaUrl: true,
  mediaMimeType: true,
  mediaFileName: true,
  storagePath: true,
  mediaSha256: true,
  mediaSizeBytes: true,
  mediaStatus: true,
  mediaAttemptCount: true,
  mediaLastErrorCode: true,
  mediaRetrievedAt: true,
  linkPreview: true,
  caption: true,
  senderDisplayName: true,
  sentByProfileId: true,
  senderPhone: true,
  recipientPhone: true,
  providerTimestamp: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
  playedAt: true,
  failedAt: true,
  isAutoResponse: true,
  autoResponseRuleId: true,
  quotedMessageId: true,
  quotedProviderMessageId: true,
  deletedForEveryoneAt: true,
  deletedByProfileId: true,
  createdAt: true,
} as const

class WhatsAppRepository implements IWhatsAppRepository {
  async findConfigByTeamId(teamId: string): Promise<WhatsAppConfigSelect | null> {
    return prisma.teamWhatsAppConfig.findUnique({
      where: { teamId },
      select: CONFIG_SELECT,
    })
  }

  async findConfigByWebhookSecret(secret: string): Promise<WhatsAppConfigSelect | null> {
    return prisma.teamWhatsAppConfig.findFirst({
      where: { webhookSecret: secret },
      select: CONFIG_SELECT,
    })
  }

  async findConfigById(id: string): Promise<WhatsAppConfigSelect | null> {
    return prisma.teamWhatsAppConfig.findUnique({
      where: { id },
      select: CONFIG_SELECT,
    })
  }

  async createConfig(data: Prisma.TeamWhatsAppConfigCreateInput): Promise<WhatsAppConfigSelect> {
    return prisma.teamWhatsAppConfig.create({
      data,
      select: CONFIG_SELECT,
    })
  }

  async updateConfig(
    id: string,
    data: Prisma.TeamWhatsAppConfigUpdateInput
  ): Promise<WhatsAppConfigSelect> {
    return prisma.teamWhatsAppConfig.update({
      where: { id },
      data,
      select: CONFIG_SELECT,
    })
  }

  async claimHistorySyncSlot(configId: string): Promise<boolean> {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000)

    await prisma.teamWhatsAppConfig.updateMany({
      where: {
        id: configId,
        historySyncStatus: "RUNNING",
        historySyncStartedAt: { lt: staleBefore },
      },
      data: {
        historySyncStatus: "FAILED",
        historySyncError: "Sincronização expirou antes de concluir.",
        historySyncCompletedAt: new Date(),
      },
    })

    const result = await prisma.teamWhatsAppConfig.updateMany({
      where: {
        id: configId,
        historySyncStatus: { notIn: ["RUNNING", "COMPLETED"] },
      },
      data: {
        historySyncStatus: "RUNNING",
        historySyncStartedAt: new Date(),
        historySyncCompletedAt: null,
        historySyncError: null,
      },
    })
    return result.count > 0
  }

  async incrementWebhookConsecutiveFailures(configId: string): Promise<{
    webhookConsecutiveFailures: number
    instanceName: string
    phoneNumber: string | null
    status: string
  }> {
    return prisma.teamWhatsAppConfig.update({
      where: { id: configId },
      data: { webhookConsecutiveFailures: { increment: 1 } },
      select: {
        webhookConsecutiveFailures: true,
        instanceName: true,
        phoneNumber: true,
        status: true,
      },
    })
  }

  async resetWebhookConsecutiveFailures(configId: string): Promise<void> {
    await prisma.teamWhatsAppConfig.updateMany({
      where: { id: configId, webhookConsecutiveFailures: { gt: 0 } },
      data: { webhookConsecutiveFailures: 0 },
    })
  }

  async deleteConfig(id: string): Promise<void> {
    await prisma.teamWhatsAppConfig.delete({ where: { id } })
  }

  async findConversationById(conversationId: string): Promise<WhatsAppConversationSelect | null> {
    return prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      select: CONVERSATION_SELECT,
    })
  }

  async searchConversations(
    teamId: string,
    query: string,
    limit: number,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<WhatsAppConversationSelect[]> {
    const term = query.trim()
    const digits = term.replace(/\D/g, "")
    return prisma.whatsAppConversation.findMany({
      where: {
        teamId,
        deletedAt: null,
        ...(visibilityWhere ? { AND: [visibilityWhere] } : {}),
        ...(term ? { OR: [
          { contactName: { contains: term, mode: "insensitive" } },
          { contactPhone: { contains: digits || term } },
          { normalizedPhone: { contains: digits || term } },
        ] } : {}),
      },
      select: CONVERSATION_SELECT,
      orderBy: { lastMessageAt: "desc" },
      take: Math.min(limit, 50),
    })
  }

  async findConversationByContactId(
    teamId: string,
    contactId: string,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<WhatsAppConversationSelect | null> {
    return prisma.whatsAppConversation.findFirst({
      where: { teamId, contactId, deletedAt: null, ...(visibilityWhere ? { AND: [visibilityWhere] } : {}) },
      select: CONVERSATION_SELECT,
      orderBy: { lastMessageAt: "desc" },
    })
  }

  async findOrCreateConversation(params: {
    teamId: string
    configId: string
    externalChatId: string
    contactPhone: string
    normalizedPhone: string
    contactName?: string
    contactId?: string
  }): Promise<WhatsAppConversationSelect> {
    const existing = await prisma.whatsAppConversation.findUnique({
      where: {
        configId_externalChatId: {
          configId: params.configId,
          externalChatId: params.externalChatId,
        },
      },
      select: CONVERSATION_SELECT,
    })

    if (existing) {
      if (existing.deletedAt) {
        return prisma.whatsAppConversation.update({
          where: { id: existing.id },
          data: { deletedAt: null, isArchived: false },
          select: CONVERSATION_SELECT,
        })
      }
      return existing
    }

    try {
      return await prisma.whatsAppConversation.create({
        data: {
          teamId: params.teamId,
          configId: params.configId,
          externalChatId: params.externalChatId,
          contactPhone: params.contactPhone,
          normalizedPhone: params.normalizedPhone,
          contactName: params.contactName ?? null,
          contactId: params.contactId ?? null,
        },
        select: CONVERSATION_SELECT,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const racedWinner = await prisma.whatsAppConversation.findUnique({
          where: {
            configId_externalChatId: {
              configId: params.configId,
              externalChatId: params.externalChatId,
            },
          },
          select: CONVERSATION_SELECT,
        })
        if (racedWinner) return racedWinner
      }
      throw error
    }
  }

  async listConversations(params: {
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
  }): Promise<{ conversations: (WhatsAppConversationSelect & { tags: ReturnType<typeof mapTagAssignmentsToSummaries> })[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const skip = (page - 1) * limit

    const baseWhere: Prisma.WhatsAppConversationWhereInput = {
      teamId: params.teamId,
      deletedAt: null,
      isArchived: params.isArchived ?? false,
      ...(params.leadId !== undefined ? { leadId: params.leadId } : {}),
      ...(params.assignedProfileId !== undefined
        ? { assignedProfileId: params.assignedProfileId }
        : {}),
      ...(params.hasUnread === true ? { unreadCount: { gt: 0 } } : {}),
      ...(params.tagIds && params.tagIds.length > 0
        ? {
            AND: params.tagIds.map((tagId) => ({
              tagAssignments: { some: { tagId } },
            })),
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { contactName: { contains: params.search, mode: "insensitive" } },
              { contactPhone: { contains: params.search, mode: "insensitive" } },
              { normalizedPhone: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const where: Prisma.WhatsAppConversationWhereInput = params.visibilityWhere
      ? { AND: [baseWhere, params.visibilityWhere] }
      : baseWhere

    const [rawConversations, total] = await prisma.$transaction([
      prisma.whatsAppConversation.findMany({
        where,
        select: CONVERSATION_LIST_SELECT,
        orderBy: [{ unreadCount: "desc" }, { lastMessageAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.whatsAppConversation.count({ where }),
    ])

    const conversations = rawConversations.map(mapConversationWithTags)

    return { conversations, total }
  }

  async getUnreadTotals(params: {
    teamId: string
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{ totalMessages: number; totalConversations: number }> {
    const baseWhere: Prisma.WhatsAppConversationWhereInput = {
      teamId: params.teamId,
      isArchived: false,
      unreadCount: { gt: 0 },
    }

    const where: Prisma.WhatsAppConversationWhereInput = params.visibilityWhere
      ? { AND: [baseWhere, params.visibilityWhere] }
      : baseWhere

    const [aggregate, totalConversations] = await prisma.$transaction([
      prisma.whatsAppConversation.aggregate({ where, _sum: { unreadCount: true } }),
      prisma.whatsAppConversation.count({ where }),
    ])

    return {
      totalMessages: aggregate._sum.unreadCount ?? 0,
      totalConversations,
    }
  }

  async updateConversation(
    id: string,
    data: Prisma.WhatsAppConversationUpdateInput
  ): Promise<WhatsAppConversationSelect> {
    return prisma.whatsAppConversation.update({
      where: { id },
      data,
      select: CONVERSATION_SELECT,
    })
  }

  async claimWelcomeSlot(conversationId: string): Promise<boolean> {
    const result = await prisma.whatsAppConversation.updateMany({
      where: { id: conversationId, welcomeSentAt: null },
      data: { welcomeSentAt: new Date() },
    })
    return result.count > 0
  }

  async linkConversationToLead(
    conversationId: string,
    leadId: string
  ): Promise<WhatsAppConversationSelect> {
    return prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { leadId },
      select: CONVERSATION_SELECT,
    })
  }

  async linkConversationToLeadIfEmpty(
    conversationId: string,
    leadId: string
  ): Promise<WhatsAppConversationSelect | null> {
    const linkResult = await prisma.whatsAppConversation.updateMany({
      where: { id: conversationId, leadId: null },
      data: { leadId },
    })

    if (linkResult.count === 0) {
      return null
    }

    return prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: CONVERSATION_SELECT,
    })
  }

  async createMessage(data: Prisma.WhatsAppMessageCreateInput): Promise<WhatsAppMessageSelect> {
    return prisma.whatsAppMessage.create({
      data,
      select: MESSAGE_SELECT,
    })
  }

  async findMessageByProviderMessageId(
    teamId: string,
    providerMessageId: string
  ): Promise<WhatsAppMessageSelect | null> {
    return prisma.whatsAppMessage.findUnique({
      where: {
        teamId_providerMessageId: { teamId, providerMessageId },
      },
      select: MESSAGE_SELECT,
    })
  }

  async findMessageByIdForTeam(
    teamId: string,
    messageId: string
  ): Promise<(WhatsAppMessageSelect & { rawPayload: Prisma.JsonValue }) | null> {
    return prisma.whatsAppMessage.findFirst({
      where: { id: messageId, teamId },
      select: { ...MESSAGE_SELECT, rawPayload: true },
    })
  }

  async updateMessageStatus(
    id: string,
    data: {
      status: WhatsAppMessageStatus
      deliveredAt?: Date
      readAt?: Date
      playedAt?: Date
      failedAt?: Date
    }
  ): Promise<WhatsAppMessageSelect> {
    return prisma.whatsAppMessage.update({
      where: { id },
      data,
      select: MESSAGE_SELECT,
    })
  }

  async markMessageDeletedForEveryone(id: string, deletedByProfileId?: string | null): Promise<void> {
    await prisma.whatsAppMessage.update({
      where: { id },
      data: {
        deletedForEveryoneAt: new Date(),
        ...(deletedByProfileId ? { deletedByProfileId } : {}),
      },
      select: { id: true },
    })
  }

  async upsertMessageReaction(params: {
    teamId: string
    messageId: string
    actorPhone: string
    emoji: string
    profileId?: string | null
    removedAt?: Date | null
  }): Promise<void> {
    const existing = await prisma.whatsAppMessageReaction.findFirst({
      where: { messageId: params.messageId, actorPhone: params.actorPhone },
      select: { id: true },
    })
    if (existing) {
      await prisma.whatsAppMessageReaction.update({
        where: { id: existing.id },
        data: {
          emoji: params.emoji,
          removedAt: params.removedAt ?? (params.emoji === "" ? new Date() : undefined),
        },
        select: { id: true },
      })
    } else {
      await prisma.whatsAppMessageReaction.create({
        data: {
          teamId: params.teamId,
          messageId: params.messageId,
          actorPhone: params.actorPhone,
          emoji: params.emoji,
          profileId: params.profileId ?? null,
          removedAt: params.removedAt ?? null,
        },
        select: { id: true },
      })
    }
  }

  async findMessageIdByStoragePath(storagePath: string): Promise<string | null> {
    const row = await prisma.whatsAppMessage.findFirst({
      where: { storagePath },
      select: { id: true },
    })
    return row?.id ?? null
  }

  async claimMediaIngestBatch(limit = 20): Promise<Array<{
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
  }>> {
    const maxAttempts = 5
    const candidates = await prisma.whatsAppMessage.findMany({
      where: {
        mediaStatus: "PROCESSING",
        mediaAttemptCount: { lt: maxAttempts },
        deletedAt: null,
        OR: [
          { mediaAttemptCount: 0 },
          { updatedAt: { lte: new Date(Date.now() - 30_000) } },
        ],
      },
      orderBy: [{ mediaAttemptCount: "asc" }, { updatedAt: "asc" }],
      take: limit,
      select: {
        id: true,
        teamId: true,
        conversationId: true,
        configId: true,
        mediaUrl: true,
        mediaMimeType: true,
        mediaFileName: true,
        mediaAttemptCount: true,
        rawPayload: true,
        providerMessageId: true,
      },
    })

    const claimed: typeof candidates = []
    for (const candidate of candidates) {
      const updated = await prisma.whatsAppMessage.updateMany({
        where: {
          id: candidate.id,
          mediaStatus: "PROCESSING",
          mediaAttemptCount: candidate.mediaAttemptCount,
        },
        data: {
          mediaAttemptCount: { increment: 1 },
        },
      })
      if (updated.count === 1) {
        claimed.push({
          ...candidate,
          mediaAttemptCount: candidate.mediaAttemptCount + 1,
        })
      }
    }
    return claimed
  }

  async markMediaIngestResult(input: {
    messageId: string
    status: "AVAILABLE" | "EXPIRED" | "FAILED" | "PROCESSING"
    storagePath?: string | null
    mediaSha256?: string | null
    mediaSizeBytes?: number | null
    errorCode?: string | null
    mediaRetrievedAt?: Date | null
  }): Promise<void> {
    await prisma.whatsAppMessage.update({
      where: { id: input.messageId },
      data: {
        mediaStatus: input.status,
        ...(input.storagePath !== undefined ? { storagePath: input.storagePath } : {}),
        ...(input.mediaSha256 !== undefined ? { mediaSha256: input.mediaSha256 } : {}),
        ...(input.mediaSizeBytes !== undefined ? { mediaSizeBytes: input.mediaSizeBytes } : {}),
        mediaLastErrorCode: input.errorCode ?? null,
        ...(input.mediaRetrievedAt !== undefined ? { mediaRetrievedAt: input.mediaRetrievedAt } : {}),
      },
    })
  }

  async listMessages(params: {
    conversationId: string
    profileId?: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 50
    const skip = (page - 1) * limit

    const where: Prisma.WhatsAppMessageWhereInput = {
      conversationId: params.conversationId,
      deletedAt: null,
      ...(params.profileId
        ? {
            NOT: {
              visibility: {
                some: { profileId: params.profileId },
              },
            },
          }
        : {}),
    }

    const [messages, total] = await prisma.$transaction([
      prisma.whatsAppMessage.findMany({
        where,
        select: MESSAGE_SELECT,
        orderBy: [
          { providerTimestamp: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.whatsAppMessage.count({ where }),
    ])

    return { messages, total }
  }

  async listInboundPendingReadReceipt(
    conversationId: string,
    limit = 100
  ): Promise<
    Array<{ id: string; providerMessageId: string | null; rawPayload: Prisma.JsonValue }>
  > {
    return prisma.whatsAppMessage.findMany({
      where: {
        conversationId,
        direction: "INBOUND",
        readAt: null,
      },
      select: {
        id: true,
        providerMessageId: true,
        rawPayload: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
  }

  async bulkSetInboundBrokerReadAt(messageIds: string[], readAt: Date): Promise<number> {
    if (messageIds.length === 0) return 0

    const result = await prisma.whatsAppMessage.updateMany({
      where: {
        id: { in: messageIds },
        direction: "INBOUND",
        readAt: null,
      },
      data: { readAt },
    })

    return result.count
  }

  async findOutboundCommand(teamId: string, clientMessageId: string): Promise<WhatsAppOutboundCommandRecord | null> {
    const [command] = await prisma.$queryRaw<WhatsAppOutboundCommandRecord[]>`
      select "conversationId", "messageId", status::text as status, "requestHash"
      from whatsapp_outbound_commands
      where "teamId" = ${teamId}::uuid and "clientMessageId" = ${clientMessageId}
    `
    return command ?? null
  }

  async createOutboundCommand(input: { teamId: string; conversationId: string; clientMessageId: string }): Promise<boolean> {
    const created = await prisma.$executeRaw`
      insert into whatsapp_outbound_commands (id, "teamId", "conversationId", "clientMessageId", status, "attemptCount", "createdAt", "updatedAt")
      values (gen_random_uuid(), ${input.teamId}::uuid, ${input.conversationId}::uuid, ${input.clientMessageId}, 'PENDING', 1, now(), now())
      on conflict ("teamId", "clientMessageId") do nothing
    `
    return created === 1
  }

  async createPendingOutboundMessageAndCommand(input: {
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
  }> {
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.whatsAppConversation.findFirst({
        where: { id: input.conversationId, teamId: input.teamId, deletedAt: null },
        select: { configId: true, leadId: true, contactPhone: true },
      })
      if (!conversation) throw new Error("Conversa não encontrada")

      const existing = await tx.whatsAppOutboundCommand.findUnique({
        where: { teamId_clientMessageId: { teamId: input.teamId, clientMessageId: input.clientMessageId } },
        select: { messageId: true, conversationId: true, requestHash: true },
      })
      if (existing) {
        return {
          created: false,
          messageId: existing.messageId,
          conversationId: existing.conversationId,
          requestHash: existing.requestHash,
        }
      }

      const message = await tx.whatsAppMessage.create({
        data: {
          conversationId: input.conversationId,
          teamId: input.teamId,
          configId: conversation.configId,
          leadId: conversation.leadId,
          clientMessageId: input.clientMessageId,
          direction: "OUTBOUND",
          messageType: input.messageType,
          status: "PENDING",
          contentText: input.contentText ?? null,
          mediaMimeType: input.mediaMimeType ?? null,
          mediaFileName: input.mediaFileName ?? null,
          caption: input.caption ?? null,
          storagePath: input.storagePath ?? null,
          mediaSha256: input.mediaSha256 ?? null,
          mediaSizeBytes: input.mediaSizeBytes ?? null,
          mediaStatus: input.storagePath ? "AVAILABLE" : null,
          recipientPhone: normalizePhone(conversation.contactPhone),
          sentByProfileId: input.sentByProfileId,
          quotedMessageId: input.quotedMessageId ?? null,
          quotedProviderMessageId: input.quotedProviderMessageId ?? null,
          rawPayload: {},
        },
        select: { id: true },
      })
      await tx.whatsAppOutboundCommand.create({
        data: {
          teamId: input.teamId,
          conversationId: input.conversationId,
          clientMessageId: input.clientMessageId,
          requestHash: input.requestHash,
          messageId: message.id,
          status: "PENDING",
          attemptCount: 1,
          claimedAt: new Date(),
          nextReconcileAt: new Date(Date.now() + 10 * 60_000),
        },
      })
      return {
        created: true,
        messageId: message.id,
        conversationId: input.conversationId,
        requestHash: input.requestHash,
      }
    })
  }

  async retryFailedOutboundCommand(input: {
    teamId: string
    clientMessageId: string
    requestHash: string
  }): Promise<{ messageId: string | null; claimed: boolean }> {
    return prisma.$transaction(async (tx) => {
      const command = await tx.whatsAppOutboundCommand.findUnique({
        where: { teamId_clientMessageId: { teamId: input.teamId, clientMessageId: input.clientMessageId } },
        select: { id: true, messageId: true, status: true, requestHash: true },
      })
      if (!command || command.status !== "FAILED" || command.requestHash !== input.requestHash) {
        return { messageId: command?.messageId ?? null, claimed: false }
      }
      await tx.whatsAppOutboundCommand.update({
        where: { id: command.id },
        data: {
          status: "PENDING",
          attemptCount: { increment: 1 },
          claimedAt: new Date(),
          nextReconcileAt: new Date(Date.now() + 10 * 60_000),
          lastError: null,
        },
      })
      if (command.messageId) {
        await tx.whatsAppMessage.update({
          where: { id: command.messageId },
          data: { status: "PENDING", failedAt: null },
        })
      }
      return { messageId: command.messageId, claimed: true }
    })
  }

  async confirmOutboundMessage(input: {
    messageId: string
    providerMessageId: string
    rawPayload: Prisma.InputJsonValue
    storagePath?: string | null
    mediaSha256?: string | null
    mediaSizeBytes?: number | null
    sentAt: Date
  }): Promise<WhatsAppMessageSelect> {
    return prisma.whatsAppMessage.update({
      where: { id: input.messageId },
      data: {
        providerMessageId: input.providerMessageId,
        status: "SENT",
        sentAt: input.sentAt,
        rawPayload: input.rawPayload,
        ...(input.storagePath !== undefined ? { storagePath: input.storagePath } : {}),
        ...(input.mediaSha256 !== undefined ? { mediaSha256: input.mediaSha256 } : {}),
        ...(input.mediaSizeBytes !== undefined ? { mediaSizeBytes: input.mediaSizeBytes } : {}),
        ...(input.storagePath ? { mediaStatus: "AVAILABLE", mediaRetrievedAt: input.sentAt } : {}),
      },
      select: MESSAGE_SELECT,
    })
  }

  async completeOutboundCommand(input: { teamId: string; clientMessageId: string; messageId: string }): Promise<void> {
    await prisma.$executeRaw`
      update whatsapp_outbound_commands
      set status = 'SENT', "messageId" = ${input.messageId}::uuid, "lastError" = null, "updatedAt" = now()
      where "teamId" = ${input.teamId}::uuid and "clientMessageId" = ${input.clientMessageId}
    `
  }

  async failOutboundCommand(input: { teamId: string; clientMessageId: string; status: "UNKNOWN" | "FAILED"; error: string }): Promise<void> {
    await prisma.$executeRaw`
      update whatsapp_outbound_commands
      set status = ${input.status}::"WhatsAppOutboundCommandStatus", "lastError" = ${input.error.slice(0, 500)}, "updatedAt" = now()
      where "teamId" = ${input.teamId}::uuid and "clientMessageId" = ${input.clientMessageId} and status = 'PENDING'
    `
  }

  async persistWebhookEvent(input: { configId: string; teamId: string; providerEventId: string; eventType: string; payload: Prisma.InputJsonValue }): Promise<string> {
    const eventId = crypto.randomUUID()
    const [event] = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into whatsapp_webhook_events (id, "configId", "teamId", "providerEventId", "eventType", payload, status, "createdAt", "updatedAt")
      values (${eventId}::uuid, ${input.configId}::uuid, ${input.teamId}::uuid, ${input.providerEventId}, ${input.eventType}, ${input.payload}, 'PENDING', now(), now())
      on conflict ("configId", "providerEventId") do update set "updatedAt" = now()
      returning id
    `
    return event!.id
  }

  async claimWebhookEvent(eventId: string): Promise<WhatsAppWebhookOutboxEvent | null> {
    const [event] = await prisma.$queryRaw<WhatsAppWebhookOutboxEvent[]>`
      update whatsapp_webhook_events
      set status = 'PROCESSING',
        "attemptCount" = "attemptCount" + 1,
        "processingStartedAt" = now(),
        "nextAttemptAt" = null,
        "updatedAt" = now()
      where id = ${eventId}::uuid
        and (
          (status = 'PENDING' and ("nextAttemptAt" is null or "nextAttemptAt" <= now()))
          or (status = 'PROCESSING' and coalesce("processingStartedAt", "updatedAt") < now() - interval '5 minutes')
        )
      returning id, "teamId", "configId", payload, "attemptCount"
    `
    return event ?? null
  }

  async completeWebhookEvent(input: {
    eventId: string
    expectedAttemptCount: number
    status: "PROCESSED" | "PENDING" | "DEAD_LETTER"
    error?: string
    nextAttemptAt?: Date | null
  }): Promise<void> {
    await prisma.$executeRaw`
      update whatsapp_webhook_events
      set status = ${input.status}::"WhatsAppWebhookEventStatus",
        "processedAt" = ${input.status === "PROCESSED" ? new Date() : null},
        "processingStartedAt" = null,
        "nextAttemptAt" = ${input.nextAttemptAt ?? null},
        "lastError" = ${input.error?.slice(0, 500) ?? null},
        "updatedAt" = now()
      where id = ${input.eventId}::uuid
        and status = 'PROCESSING'
        and "attemptCount" = ${input.expectedAttemptCount}
    `
  }

  async listPendingWebhookEventIds(limit: number): Promise<string[]> {
    const events = await prisma.$queryRaw<Array<{ id: string }>>`
      select id from whatsapp_webhook_events
      where (status = 'PENDING' and ("nextAttemptAt" is null or "nextAttemptAt" <= now()))
        or (status = 'PROCESSING' and coalesce("processingStartedAt", "updatedAt") < now() - interval '5 minutes')
      order by "createdAt" asc limit ${Math.min(limit, 100)}
    `
    return events.map((event) => event.id)
  }

  async requeueDeadLetterEvent(input: { eventId: string; teamId: string; actorProfileId: string }): Promise<boolean> {
    const updated = await prisma.$executeRaw`
      update whatsapp_webhook_events
      set status = 'PENDING', "attemptCount" = 0, "lastError" = null,
        "nextAttemptAt" = now(), "processingStartedAt" = null, "updatedAt" = now()
      where id = ${input.eventId}::uuid and "teamId" = ${input.teamId}::uuid and status = 'DEAD_LETTER'
    `
    if (updated !== 1) return false
    await this.createAuditEvent({
      teamId: input.teamId,
      actorProfileId: input.actorProfileId,
      action: "webhook.dead_letter.requeue",
      metadata: { eventId: input.eventId },
    })
    return true
  }

  async requeueAllDeadLetterEvents(input: { teamId: string; actorProfileId: string }): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const requeuedCount = await tx.$executeRaw`
        update whatsapp_webhook_events
        set status = 'PENDING', "attemptCount" = 0, "lastError" = null,
          "nextAttemptAt" = now(), "processingStartedAt" = null, "updatedAt" = now()
        where "teamId" = ${input.teamId}::uuid and status = 'DEAD_LETTER'
      `
      const count = Number(requeuedCount)
      if (count > 0) {
        await tx.whatsAppAuditEvent.create({
          data: {
            teamId: input.teamId,
            actorProfileId: input.actorProfileId,
            action: "webhook.dead_letter.requeue_all",
            metadata: { requeuedCount: count },
          },
        })
      }
      return count
    })
  }

  async reconcileStaleOutboundCommands(now = new Date()): Promise<number> {
    const updated = await prisma.$executeRaw`
      update whatsapp_outbound_commands
      set status = 'UNKNOWN',
        "lastError" = 'Envio sem confirmação do provedor; confirme no histórico antes de reenviar.',
        "reconciledAt" = now(), "updatedAt" = now()
      where status = 'PENDING'
        and (
          ("nextReconcileAt" is not null and "nextReconcileAt" <= ${now})
          or ("nextReconcileAt" is null and "createdAt" < ${new Date(now.getTime() - 10 * 60_000)})
        )
    `
    return updated
  }

  async enqueueContactSyncJob(input: { teamId: string; configId: string }): Promise<string> {
    const existing = await prisma.whatsAppSyncJob.findFirst({
      where: { teamId: input.teamId, configId: input.configId, status: { in: ["PENDING", "RUNNING"] } },
      select: { id: true },
    })
    if (existing) return existing.id
    const job = await prisma.whatsAppSyncJob.create({
      data: { teamId: input.teamId, configId: input.configId },
      select: { id: true },
    })
    return job.id
  }

  async listConnectedContactSyncTargets(): Promise<Array<{ teamId: string; configId: string }>> {
    return prisma.teamWhatsAppConfig.findMany({
      where: { status: "CONNECTED", primaryConfigId: null },
      select: { teamId: true, id: true },
    }).then((configs) => configs.map((config) => ({ teamId: config.teamId, configId: config.id })))
  }

  async claimNextContactSyncJob(workerId: string): Promise<{ id: string; teamId: string; configId: string; checkpoint: unknown } | null> {
    const candidate = await prisma.whatsAppSyncJob.findFirst({
      where: {
        OR: [
          { status: "PENDING" },
          { status: "RUNNING", leaseExpiresAt: { lt: new Date() } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, teamId: true, configId: true, checkpoint: true },
    })
    if (!candidate) return null
    const claimed = await prisma.whatsAppSyncJob.updateMany({
      where: {
        id: candidate.id,
        OR: [{ status: "PENDING" }, { status: "RUNNING", leaseExpiresAt: { lt: new Date() } }],
      },
      data: {
        status: "RUNNING",
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + 45_000),
        startedAt: new Date(),
        lastError: null,
      },
    })
    return claimed.count ? candidate : null
  }

  async renewContactSyncJobLease(input: { jobId: string; workerId: string; checkpoint: unknown }): Promise<void> {
    await prisma.whatsAppSyncJob.updateMany({
      where: { id: input.jobId, leaseOwner: input.workerId, status: "RUNNING" },
      data: {
        checkpoint: input.checkpoint as Prisma.InputJsonValue,
        leaseExpiresAt: new Date(Date.now() + 45_000),
        updatedAt: new Date(),
      },
    })
  }

  async parkContactSyncJob(input: { jobId: string; checkpoint: unknown }): Promise<void> {
    await prisma.whatsAppSyncJob.update({
      where: { id: input.jobId },
      data: {
        status: "PENDING",
        checkpoint: input.checkpoint as Prisma.InputJsonValue,
        leaseOwner: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      },
    })
  }

  async completeContactSyncJob(input: { jobId: string; error?: string }): Promise<void> {
    await prisma.whatsAppSyncJob.update({
      where: { id: input.jobId },
      data: input.error
        ? { status: "FAILED", lastError: input.error.slice(0, 500), leaseOwner: null, leaseExpiresAt: null, completedAt: new Date() }
        : { status: "COMPLETED", leaseOwner: null, leaseExpiresAt: null, completedAt: new Date() },
    })
  }

  async createUsageEvent(data: Prisma.WhatsAppUsageEventCreateInput): Promise<{ id: string }> {
    return prisma.whatsAppUsageEvent.create({
      data,
      select: { id: true },
    })
  }

  async getUsageSummary(params: {
    teamId: string
    periodKey: string
  }): Promise<{ outboundCount: number; inboundCount: number }> {
    const [outboundCount, inboundCount] = await prisma.$transaction([
      prisma.whatsAppUsageEvent.count({
        where: {
          teamId: params.teamId,
          periodKey: params.periodKey,
          direction: "OUTBOUND",
          countedTowardsQuota: true,
        },
      }),
      prisma.whatsAppUsageEvent.count({
        where: {
          teamId: params.teamId,
          periodKey: params.periodKey,
          direction: "INBOUND",
        },
      }),
    ])

    return { outboundCount, inboundCount }
  }

  async listMessagesSince(params: {
    teamId: string
    since: Date
  }): Promise<WhatsAppMessageSelect[]> {
    return prisma.whatsAppMessage.findMany({
      where: {
        teamId: params.teamId,
        sentAt: { gte: params.since },
      },
      select: MESSAGE_SELECT,
      orderBy: { sentAt: "asc" },
      take: 10000,
    })
  }

  async listConversationsForTeam(teamId: string): Promise<WhatsAppConversationSelect[]> {
    return prisma.whatsAppConversation.findMany({
      where: { teamId },
      select: CONVERSATION_SELECT,
      orderBy: { lastMessageAt: "desc" },
    })
  }

  async softDeleteConversation(id: string): Promise<void> {
    const now = new Date()
    await prisma.$transaction([
      prisma.whatsAppConversation.update({
        where: { id },
        data: { deletedAt: now, isArchived: true },
      }),
      prisma.whatsAppMessage.updateMany({
        where: { conversationId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ])
  }

  async softDeleteConversationWithAudit(input: {
    conversationId: string
    teamId: string
    actorProfileId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }): Promise<void> {
    const now = new Date()
    await prisma.$transaction([
      prisma.whatsAppConversation.update({
        where: { id: input.conversationId },
        data: { deletedAt: now, isArchived: true },
      }),
      prisma.whatsAppMessage.updateMany({
        where: { conversationId: input.conversationId, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.whatsAppAuditEvent.create({
        data: {
          teamId: input.teamId,
          conversationId: input.conversationId,
          actorProfileId: input.actorProfileId ?? null,
          action: input.action,
          metadata: input.metadata ?? {},
        },
      }),
    ])
  }

  async softDeleteAllTeamConversationsWithAudit(input: {
    teamId: string
    actorProfileId: string
  }): Promise<number> {
    const now = new Date()
    const conversations = await prisma.whatsAppConversation.findMany({
      where: { teamId: input.teamId, deletedAt: null },
      select: { id: true },
    })
    if (conversations.length === 0) return 0

    const conversationIds = conversations.map((conversation) => conversation.id)
    await prisma.$transaction([
      prisma.whatsAppConversation.updateMany({
        where: { id: { in: conversationIds } },
        data: { deletedAt: now, isArchived: true },
      }),
      prisma.whatsAppMessage.updateMany({
        where: { conversationId: { in: conversationIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.whatsAppAuditEvent.create({
        data: {
          teamId: input.teamId,
          actorProfileId: input.actorProfileId,
          action: "conversations.purge",
          metadata: { count: conversations.length },
        },
      }),
    ])
    return conversations.length
  }

  async createAuditEvent(input: {
    teamId: string
    conversationId?: string | null
    actorProfileId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }): Promise<void> {
    await prisma.whatsAppAuditEvent.create({
      data: {
        teamId: input.teamId,
        conversationId: input.conversationId ?? null,
        actorProfileId: input.actorProfileId ?? null,
        action: input.action,
        metadata: input.metadata ?? {},
      },
    })
  }

  async deleteConversation(id: string): Promise<void> {
    await this.softDeleteConversation(id)
  }

  async resetInboxForConfigChange(configId: string, teamId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.deleteMany({ where: { configId } })
      await tx.teamWhatsAppContact.deleteMany({ where: { teamId } })
      await tx.teamWhatsAppConfig.update({
        where: { id: configId },
        data: {
          historySyncStatus: "IDLE",
          historySyncStartedAt: null,
          historySyncCompletedAt: null,
          historySyncError: null,
          lastSyncAt: null,
        },
      })
    })
    console.info("[WhatsAppRepository][resetInboxForConfigChange]", { configId, teamId })
  }

  async findTeamMasterContext(
    teamId: string
  ): Promise<{ masterId: string; timezone: string | null } | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        masterId: true,
        master: { select: { timezone: true } },
      },
    })
    if (!team) return null
    return { masterId: team.masterId, timezone: team.master.timezone }
  }

  async findConnectedConfigByNormalizedPhone(
    normalizedPhone: string,
    excludeConfigId?: string
  ): Promise<{ id: string; teamId: string; masterId: string; primaryConfigId: string | null } | null> {
    const config = await prisma.teamWhatsAppConfig.findFirst({
      where: {
        normalizedPhone,
        status: "CONNECTED",
        ...(excludeConfigId ? { id: { not: excludeConfigId } } : {}),
      },
      select: {
        id: true,
        teamId: true,
        primaryConfigId: true,
        team: { select: { masterId: true } },
      },
    })
    if (!config) return null
    return {
      id: config.id,
      teamId: config.teamId,
      masterId: config.team.masterId,
      primaryConfigId: config.primaryConfigId,
    }
  }

  async findMirroredConfigs(primaryConfigId: string): Promise<WhatsAppConfigSelect[]> {
    return prisma.teamWhatsAppConfig.findMany({
      where: { primaryConfigId },
      select: CONFIG_SELECT,
    })
  }

  async findConfigByInstanceName(instanceName: string): Promise<WhatsAppConfigSelect | null> {
    return prisma.teamWhatsAppConfig.findFirst({
      where: { instanceName, primaryConfigId: null },
      select: CONFIG_SELECT,
    })
  }

  async resolveEffectiveConfig(config: WhatsAppConfigSelect): Promise<WhatsAppConfigSelect> {
    if (!config.primaryConfigId) return config
    const primary = await this.findConfigById(config.primaryConfigId)
    return primary ?? config
  }

  async findLeadTeamIdByPhoneForMaster(
    masterId: string,
    normalizedPhone: string,
    fallbackTeamId: string
  ): Promise<string> {
    const digits = normalizedPhone.replace(/\D/g, "")
    const leads = await prisma.lead.findMany({
      where: {
        team: { masterId },
        phone: { not: null },
        OR: [
          { phone: normalizedPhone },
          ...(digits ? [{ phone: { endsWith: digits.slice(-11) } }] : []),
        ],
      },
      select: { teamId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    const withTeam = leads.filter((l) => l.teamId)
    if (withTeam.length === 0) return fallbackTeamId
    return withTeam[0]!.teamId!
  }

  async listConnectedConfigsForMaster(masterId: string): Promise<
    Array<WhatsAppConfigSelect & { teamName: string }>
  > {
    const configs = await prisma.teamWhatsAppConfig.findMany({
      where: {
        status: "CONNECTED",
        phoneNumber: { not: null },
        team: { masterId },
        primaryConfigId: null,
      },
      select: {
        id: true,
        teamId: true,
        provider: true,
        instanceName: true,
        instanceId: true,
        phoneNumber: true,
        normalizedPhone: true,
        lastConnectedNormalizedPhone: true,
        primaryConfigId: true,
        displayName: true,
        status: true,
        qrCodeText: true,
        qrCodeImageUrl: true,
        webhookSecret: true,
        lastConnectedAt: true,
        lastDisconnectedAt: true,
        lastSyncAt: true,
        historySyncStatus: true,
        historySyncStartedAt: true,
        historySyncCompletedAt: true,
        historySyncError: true,
        usageLimitMonthly: true,
        billingEnabled: true,
        createdAt: true,
        updatedAt: true,
        team: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    })

    return configs.map(({ team, ...config }) => ({
      ...config,
      teamName: team.name,
    }))
  }

  async getOperatorProfileIdsForTeam(teamId: string): Promise<string[]> {
    const members = await prisma.teamMember.findMany({
      where: { teamId, role: "operator" },
      select: { profileId: true },
    })
    return members.map((m) => m.profileId)
  }

  async getOperatorLeadPhones(teamId: string, profileId: string): Promise<string[]> {
    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        phone: { not: null },
        OR: [{ assignedTo: profileId }, { closerId: profileId }],
      },
      select: { phone: true },
    })

    const phones = new Set<string>()
    for (const lead of leads) {
      if (!lead.phone) continue
      try {
        phones.add(normalizePhone(lead.phone))
      } catch {
        const digits = lead.phone.replace(/\D/g, "")
        if (digits) phones.add(digits)
      }
    }
    return Array.from(phones)
  }

  async countConversationsWithVisibility(
    conversationId: string,
    teamId: string,
    visibilityWhere: Prisma.WhatsAppConversationWhereInput
  ): Promise<number> {
    return prisma.whatsAppConversation.count({
      where: {
        id: conversationId,
        teamId,
        AND: [visibilityWhere],
      },
    })
  }

  async findConversationByIdForTeam(
    conversationId: string,
    teamId: string
  ): Promise<WhatsAppConversationSelect | null> {
    return prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, teamId, deletedAt: null },
      select: CONVERSATION_SELECT,
    })
  }

  async listConversationContactKeysForTeam(
    teamId: string,
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  ): Promise<Array<{ normalizedPhone: string; externalChatId: string | null }>> {
    return prisma.whatsAppConversation.findMany({
      where: {
        teamId,
        ...(visibilityWhere ? { AND: [visibilityWhere] } : {}),
      },
      select: { normalizedPhone: true, externalChatId: true },
      take: 5000,
    })
  }

  async findConversationByExternalChatId(
    teamId: string,
    externalChatId: string
  ): Promise<WhatsAppConversationSelect | null> {
    return prisma.whatsAppConversation.findFirst({
      where: { teamId, externalChatId },
      select: CONVERSATION_SELECT,
    })
  }

  async findConversationsByExternalChatIds(
    teamId: string,
    externalChatIds: string[]
  ): Promise<WhatsAppConversationSelect[]> {
    if (externalChatIds.length === 0) return []
    return prisma.whatsAppConversation.findMany({
      where: { teamId, externalChatId: { in: externalChatIds } },
      select: CONVERSATION_SELECT,
    })
  }

  async getMessageActionsState(input: {
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
  } | null> {
    const message = await prisma.whatsAppMessage.findFirst({
      where: { id: input.messageId, teamId: input.teamId },
      select: {
        id: true,
        conversationId: true,
        deletedForEveryoneAt: true,
      },
    })
    if (!message) return null

    const [favorite, pin, visibility, reactions] = await Promise.all([
      prisma.whatsAppMessageFavorite.findUnique({
        where: {
          messageId_profileId: { messageId: input.messageId, profileId: input.profileId },
        },
        select: { id: true },
      }),
      prisma.whatsAppMessagePin.findFirst({
        where: { messageId: input.messageId, teamId: input.teamId, removedAt: null },
        select: { id: true },
      }),
      prisma.whatsAppMessageVisibility.findUnique({
        where: {
          messageId_profileId: { messageId: input.messageId, profileId: input.profileId },
        },
        select: { id: true },
      }),
      prisma.whatsAppMessageReaction.findMany({
        where: { messageId: input.messageId, teamId: input.teamId, removedAt: null },
        select: { emoji: true, profileId: true, removedAt: true },
        take: 50,
      }),
    ])

    return {
      messageId: message.id,
      conversationId: message.conversationId,
      isFavorite: favorite != null,
      isPinned: pin != null,
      isHidden: visibility != null,
      reactions,
      deletedForEveryoneAt: message.deletedForEveryoneAt,
    }
  }

  async upsertMessageFavorite(input: {
    teamId: string
    messageId: string
    profileId: string
  }): Promise<void> {
    await prisma.whatsAppMessageFavorite.upsert({
      where: {
        messageId_profileId: { messageId: input.messageId, profileId: input.profileId },
      },
      create: {
        teamId: input.teamId,
        messageId: input.messageId,
        profileId: input.profileId,
      },
      update: {},
      select: { id: true },
    })
  }

  async removeMessageFavorite(input: {
    teamId: string
    messageId: string
    profileId: string
  }): Promise<void> {
    await prisma.whatsAppMessageFavorite.deleteMany({
      where: {
        teamId: input.teamId,
        messageId: input.messageId,
        profileId: input.profileId,
      },
    })
  }

  async pinMessage(input: {
    teamId: string
    conversationId: string
    messageId: string
    pinnedByProfileId: string
    expiresAt?: Date | null
  }): Promise<void> {
    const existing = await prisma.whatsAppMessagePin.findFirst({
      where: { messageId: input.messageId, teamId: input.teamId, removedAt: null },
      select: { id: true },
    })
    if (existing) {
      await prisma.whatsAppMessagePin.update({
        where: { id: existing.id },
        data: {
          pinnedByProfileId: input.pinnedByProfileId,
          pinnedAt: new Date(),
          expiresAt: input.expiresAt ?? null,
          removedAt: null,
        },
        select: { id: true },
      })
      return
    }
    await prisma.whatsAppMessagePin.create({
      data: {
        teamId: input.teamId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        pinnedByProfileId: input.pinnedByProfileId,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true },
    })
  }

  async unpinMessage(input: { teamId: string; messageId: string }): Promise<void> {
    await prisma.whatsAppMessagePin.updateMany({
      where: { teamId: input.teamId, messageId: input.messageId, removedAt: null },
      data: { removedAt: new Date() },
    })
  }

  async hideMessageForProfile(input: {
    teamId: string
    messageId: string
    profileId: string
  }): Promise<void> {
    await prisma.whatsAppMessageVisibility.upsert({
      where: {
        messageId_profileId: { messageId: input.messageId, profileId: input.profileId },
      },
      create: {
        teamId: input.teamId,
        messageId: input.messageId,
        profileId: input.profileId,
      },
      update: { hiddenAt: new Date() },
      select: { id: true },
    })
  }

  async findActionCommand(input: {
    teamId: string
    clientActionId: string
  }): Promise<{
    id: string
    messageId: string
    kind: string
    status: string
    requestHash: string | null
  } | null> {
    return prisma.whatsAppMessageActionCommand.findUnique({
      where: {
        teamId_clientActionId: { teamId: input.teamId, clientActionId: input.clientActionId },
      },
      select: {
        id: true,
        messageId: true,
        kind: true,
        status: true,
        requestHash: true,
      },
    })
  }

  async createActionCommand(input: {
    teamId: string
    messageId: string
    profileId: string
    clientActionId: string
    kind: "REACT" | "UNREACT" | "DELETE_FOR_EVERYONE"
    requestHash: string
    emoji?: string | null
  }): Promise<{ created: boolean; id: string; status: string }> {
    try {
      const created = await prisma.whatsAppMessageActionCommand.create({
        data: {
          teamId: input.teamId,
          messageId: input.messageId,
          profileId: input.profileId,
          clientActionId: input.clientActionId,
          kind: input.kind,
          status: "PENDING",
          requestHash: input.requestHash,
          emoji: input.emoji ?? null,
          attemptCount: 1,
          claimedAt: new Date(),
        },
        select: { id: true, status: true },
      })
      return { created: true, id: created.id, status: created.status }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.findActionCommand({
          teamId: input.teamId,
          clientActionId: input.clientActionId,
        })
        if (existing) {
          return { created: false, id: existing.id, status: existing.status }
        }
      }
      throw error
    }
  }

  async searchMessagesInConversation(input: {
    teamId: string
    conversationId: string
    profileId: string
    query: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }> {
    const page = Math.max(input.page ?? 1, 1)
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50)
    const q = input.query.trim()
    if (!q) return { messages: [], total: 0 }

    const where: Prisma.WhatsAppMessageWhereInput = {
      teamId: input.teamId,
      conversationId: input.conversationId,
      deletedAt: null,
      deletedForEveryoneAt: null,
      OR: [
        { contentText: { contains: q, mode: "insensitive" } },
        { caption: { contains: q, mode: "insensitive" } },
      ],
      NOT: {
        visibility: {
          some: { profileId: input.profileId },
        },
      },
    }

    const [total, messages] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.findMany({
        where,
        select: MESSAGE_SELECT,
        orderBy: [{ providerTimestamp: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { messages, total }
  }

  async mergeMessageRawPayload(
    messageId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
      select: { rawPayload: true },
    })
    const raw =
      existing?.rawPayload &&
      typeof existing.rawPayload === "object" &&
      !Array.isArray(existing.rawPayload)
        ? (existing.rawPayload as Record<string, unknown>)
        : {}
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        rawPayload: {
          ...raw,
          ...patch,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
  }

  async getTeamOpsMetrics(teamId: string): Promise<{
    deadLetterCount: number
    pendingWebhookCount: number
    unknownOutboundCount: number
    failedMediaCount: number
    pendingActionCommandCount: number
    unknownActionCommandCount: number
  }> {
    const [
      deadLetterCount,
      pendingWebhookCount,
      unknownOutboundCount,
      failedMediaCount,
      pendingActionCommandCount,
      unknownActionCommandCount,
    ] = await Promise.all([
      prisma.whatsAppWebhookEvent.count({
        where: { teamId, status: "DEAD_LETTER" },
      }),
      prisma.whatsAppWebhookEvent.count({
        where: { teamId, status: { in: ["PENDING", "PROCESSING"] } },
      }),
      prisma.whatsAppOutboundCommand.count({
        where: { teamId, status: "UNKNOWN" },
      }),
      prisma.whatsAppMessage.count({
        where: { teamId, mediaStatus: "FAILED", deletedAt: null },
      }),
      prisma.whatsAppMessageActionCommand.count({
        where: { teamId, status: "PENDING" },
      }),
      prisma.whatsAppMessageActionCommand.count({
        where: { teamId, status: "UNKNOWN" },
      }),
    ])

    return {
      deadLetterCount,
      pendingWebhookCount,
      unknownOutboundCount,
      failedMediaCount,
      pendingActionCommandCount,
      unknownActionCommandCount,
    }
  }
}

export const whatsAppRepository = new WhatsAppRepository()
