import type { Prisma, WhatsAppMessageStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
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
  displayName: true,
  status: true,
  qrCodeText: true,
  qrCodeImageUrl: true,
  webhookSecret: true,
  hostBaseUrl: true,
  lastConnectedAt: true,
  lastDisconnectedAt: true,
  lastSyncAt: true,
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
  normalizedPhone: true,
  assignedProfileId: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  unreadCount: true,
  isArchived: true,
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
  caption: true,
  sentByProfileId: true,
  senderPhone: true,
  recipientPhone: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
  failedAt: true,
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

    return prisma.whatsAppConversation.create({
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
  }): Promise<{ conversations: WhatsAppConversationSelect[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const skip = (page - 1) * limit

    const where: Prisma.WhatsAppConversationWhereInput = {
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

    const [conversations, total] = await prisma.$transaction([
      prisma.whatsAppConversation.findMany({
        where,
        select: CONVERSATION_SELECT,
        orderBy: { lastMessageAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.whatsAppConversation.count({ where }),
    ])

    return { conversations, total }
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

  async deleteConversation(id: string): Promise<void> {
    await prisma.whatsAppConversation.delete({ where: { id } })
  }
}

export const whatsAppRepository = new WhatsAppRepository()
