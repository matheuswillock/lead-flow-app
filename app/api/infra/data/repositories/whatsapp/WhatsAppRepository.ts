import { Prisma, type WhatsAppMessageStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { normalizePhone } from "@/lib/whatsapp/normalize-phone"
import type {
  IWhatsAppRepository,
  WhatsAppConfigSelect,
  WhatsAppConversationSelect,
  WhatsAppMessageSelect,
} from "./IWhatsAppRepository"

const CONFIG_SELECT = {
  id: true,
  teamId: true,
  provider: true,
  instanceName: true,
  instanceId: true,
  phoneNumber: true,
  normalizedPhone: true,
  primaryConfigId: true,
  displayName: true,
  status: true,
  qrCodeText: true,
  qrCodeImageUrl: true,
  webhookSecret: true,
  hostBaseUrl: true,
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
} as const

const CONVERSATION_SELECT = {
  id: true,
  teamId: true,
  configId: true,
  leadId: true,
  externalChatId: true,
  contactPhone: true,
  contactName: true,
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
  createdAt: true,
  updatedAt: true,
} as const

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  teamId: true,
  configId: true,
  leadId: true,
  providerMessageId: true,
  direction: true,
  messageType: true,
  status: true,
  contentText: true,
  mediaUrl: true,
  mediaMimeType: true,
  mediaFileName: true,
  linkPreview: true,
  caption: true,
  senderDisplayName: true,
  sentByProfileId: true,
  senderPhone: true,
  recipientPhone: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
  failedAt: true,
  isAutoResponse: true,
  autoResponseRuleId: true,
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

  async deleteConfig(id: string): Promise<void> {
    await prisma.teamWhatsAppConfig.delete({ where: { id } })
  }

  async findConversationById(conversationId: string): Promise<WhatsAppConversationSelect | null> {
    return prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: CONVERSATION_SELECT,
    })
  }

  async findOrCreateConversation(params: {
    teamId: string
    configId: string
    externalChatId: string
    contactPhone: string
    normalizedPhone: string
    contactName?: string
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

    if (existing) return existing

    try {
      return await prisma.whatsAppConversation.create({
        data: {
          teamId: params.teamId,
          configId: params.configId,
          externalChatId: params.externalChatId,
          contactPhone: params.contactPhone,
          normalizedPhone: params.normalizedPhone,
          contactName: params.contactName ?? null,
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
    page?: number
    limit?: number
    visibilityWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{ conversations: WhatsAppConversationSelect[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const skip = (page - 1) * limit

    const baseWhere: Prisma.WhatsAppConversationWhereInput = {
      teamId: params.teamId,
      isArchived: params.isArchived ?? false,
      ...(params.leadId !== undefined ? { leadId: params.leadId } : {}),
      ...(params.assignedProfileId !== undefined
        ? { assignedProfileId: params.assignedProfileId }
        : {}),
      ...(params.hasUnread === true ? { unreadCount: { gt: 0 } } : {}),
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

    const [conversations, total] = await prisma.$transaction([
      prisma.whatsAppConversation.findMany({
        where,
        select: CONVERSATION_SELECT,
        orderBy: [{ unreadCount: "desc" }, { lastMessageAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.whatsAppConversation.count({ where }),
    ])

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
      failedAt?: Date
    }
  ): Promise<WhatsAppMessageSelect> {
    return prisma.whatsAppMessage.update({
      where: { id },
      data,
      select: MESSAGE_SELECT,
    })
  }

  async listMessages(params: {
    conversationId: string
    page?: number
    limit?: number
  }): Promise<{ messages: WhatsAppMessageSelect[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 50
    const skip = (page - 1) * limit

    const where: Prisma.WhatsAppMessageWhereInput = {
      conversationId: params.conversationId,
    }

    const [messages, total] = await prisma.$transaction([
      prisma.whatsAppMessage.findMany({
        where,
        select: MESSAGE_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.whatsAppMessage.count({ where }),
    ])

    return { messages, total }
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

  async deleteConversation(id: string): Promise<void> {
    await prisma.whatsAppConversation.delete({ where: { id } })
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
          ...(digits ? [{ phone: { contains: digits.slice(-11) } }] : []),
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
        primaryConfigId: true,
        displayName: true,
        status: true,
        qrCodeText: true,
        qrCodeImageUrl: true,
        webhookSecret: true,
        hostBaseUrl: true,
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
      where: { id: conversationId, teamId },
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
}

export const whatsAppRepository = new WhatsAppRepository()
