import type {
  BackofficeBotAuthChallengeSource,
  BackofficeBotAuthChallengeStatus,
  BackofficeBotChannelStatus,
  BackofficeBotEventOutboxStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { normalizePhoneE164 } from "@/lib/studio-bot/phone";
import { STUDIO_BOT_OUTBOX_MAX_ATTEMPTS } from "@/lib/studio-bot/outbox-retry";
import type {
  CreateAuthChallengeInput,
  CreateMessageInput,
  CreateOutboxEventInput,
  CreateUserLinkInput,
  IBackofficeBotRepository,
  ListConversationsFilters,
} from "./IBackofficeBotRepository";

function buildConversationSearchWhere(
  search?: string
): Prisma.BackofficeBotUserLinkWhereInput | undefined {
  if (!search?.trim()) {
    return undefined;
  }

  const q = search.trim();
  return {
    OR: [
      { normalizedPhone: { contains: q } },
      { profile: { fullName: { contains: q, mode: "insensitive" } } },
      { profile: { email: { contains: q, mode: "insensitive" } } },
    ],
  };
}

class PrismaBackofficeBotRepository implements IBackofficeBotRepository {
  async findProfileByEmail(email: string) {
    return prisma.profile.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true, activeTeamId: true, email: true, fullName: true },
    });
  }

  async findProfileBotContext(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        fullName: true,
        activeTeamId: true,
        isMaster: true,
      },
    });
  }

  async findTeamMemberForBot(teamId: string, profileId: string) {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { role: true, functions: true },
    });
  }

  async findTeamName(teamId: string) {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
  }

  async findPendingWebOtpChallenges(limit = 10) {
    return prisma.backofficeBotAuthChallenge.findMany({
      where: {
        source: "web_otp",
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async findProfileActiveTeam(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, activeTeamId: true },
    });
  }

  async getActiveChannel() {
    return prisma.backofficeBotChannel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findPrimaryChannel() {
    return prisma.backofficeBotChannel.findFirst({
      orderBy: { createdAt: "asc" },
    });
  }

  async findChannelById(channelId: string) {
    return prisma.backofficeBotChannel.findUnique({ where: { id: channelId } });
  }

  async upsertChannel(data: {
    displayName?: string;
    aboutText?: string | null;
    avatarUrl?: string | null;
    avatarStoragePath?: string | null;
    phoneNumber?: string | null;
    status?: BackofficeBotChannelStatus;
    providerConfig?: Prisma.InputJsonValue;
    webhookSecret?: string;
    n8nInboundUrl?: string | null;
    n8nOutboundSecret?: string;
    isActive?: boolean;
  }) {
    const existing = await this.findPrimaryChannel();
    const webhookSecret =
      data.webhookSecret ??
      process.env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET?.trim() ??
      cryptoRandomSecret();
    const n8nOutboundSecret = data.n8nOutboundSecret ?? webhookSecret;

    if (existing) {
      return prisma.backofficeBotChannel.update({
        where: { id: existing.id },
        data: {
          displayName: data.displayName,
          aboutText: data.aboutText,
          avatarUrl: data.avatarUrl,
          avatarStoragePath: data.avatarStoragePath,
          phoneNumber: data.phoneNumber,
          status: data.status,
          providerConfig: data.providerConfig,
          webhookSecret: data.webhookSecret,
          n8nInboundUrl: data.n8nInboundUrl,
          n8nOutboundSecret: data.n8nOutboundSecret,
          isActive: data.isActive,
        },
      });
    }

    return prisma.backofficeBotChannel.create({
      data: {
        displayName: data.displayName ?? "Bethânia",
        aboutText: data.aboutText ?? null,
        avatarUrl: data.avatarUrl ?? null,
        avatarStoragePath: data.avatarStoragePath ?? null,
        phoneNumber: data.phoneNumber ?? null,
        status: data.status ?? "pending",
        providerConfig: data.providerConfig ?? {},
        webhookSecret,
        n8nInboundUrl: data.n8nInboundUrl ?? null,
        n8nOutboundSecret,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateChannelProfile(
    channelId: string,
    data: {
      displayName?: string;
      aboutText?: string | null;
      avatarUrl?: string | null;
      avatarStoragePath?: string | null;
      lastProfileSyncAt?: Date | null;
    }
  ) {
    return prisma.backofficeBotChannel.update({
      where: { id: channelId },
      data,
    });
  }

  async createAuthChallenge(input: CreateAuthChallengeInput) {
    return prisma.backofficeBotAuthChallenge.create({
      data: {
        source: input.source,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        normalizedPhone: input.normalizedPhone ?? null,
        emailRequested: input.emailRequested ?? null,
        profileId: input.profileId ?? null,
        ipMetadata: input.ipMetadata,
      },
    });
  }

  async findAuthChallengeById(id: string) {
    return prisma.backofficeBotAuthChallenge.findUnique({ where: { id } });
  }

  async findPendingChallengeByPhone(normalizedPhone: string) {
    return prisma.backofficeBotAuthChallenge.findFirst({
      where: {
        normalizedPhone,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingChallengeByProfile(profileId: string) {
    return prisma.backofficeBotAuthChallenge.findFirst({
      where: {
        profileId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async expirePendingChallengesForProfile(profileId: string) {
    const result = await prisma.backofficeBotAuthChallenge.updateMany({
      where: { profileId, status: "pending" },
      data: { status: "expired" },
    });
    return result.count;
  }

  async expirePendingChallengesForPhone(normalizedPhone: string) {
    const result = await prisma.backofficeBotAuthChallenge.updateMany({
      where: { normalizedPhone, status: "pending" },
      data: { status: "expired" },
    });
    return result.count;
  }

  async incrementChallengeAttempt(id: string) {
    return prisma.backofficeBotAuthChallenge.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async updateChallengeStatus(
    id: string,
    status: BackofficeBotAuthChallengeStatus,
    data?: { verifiedAt?: Date; profileId?: string; normalizedPhone?: string }
  ) {
    return prisma.backofficeBotAuthChallenge.update({
      where: { id },
      data: {
        status,
        verifiedAt: data?.verifiedAt,
        profileId: data?.profileId,
        normalizedPhone: data?.normalizedPhone,
      },
    });
  }

  async countRecentChallengesForProfile(profileId: string, since: Date) {
    return prisma.backofficeBotAuthChallenge.count({
      where: { profileId, createdAt: { gte: since } },
    });
  }

  async listAuthChallenges(
    filters: { source?: BackofficeBotAuthChallengeSource; status?: BackofficeBotAuthChallengeStatus },
    pagination: { page: number; pageSize: number }
  ) {
    const where: Prisma.BackofficeBotAuthChallengeWhereInput = {};
    if (filters.source) where.source = filters.source;
    if (filters.status) where.status = filters.status;

    const skip = (pagination.page - 1) * pagination.pageSize;
    const [items, totalItems] = await Promise.all([
      prisma.backofficeBotAuthChallenge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.backofficeBotAuthChallenge.count({ where }),
    ]);

    return { items, totalItems };
  }

  async findActiveUserLinkByPhone(normalizedPhone: string) {
    return prisma.backofficeBotUserLink.findFirst({
      where: { normalizedPhone, isActive: true },
      select: {
        id: true,
        profileId: true,
        normalizedPhone: true,
        linkedAt: true,
        linkedBy: true,
        authChallengeId: true,
        isActive: true,
        lastInteractionAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            supabaseId: true,
          },
        },
      },
    });
  }

  async findActiveUserLinkByProfile(profileId: string) {
    return prisma.backofficeBotUserLink.findFirst({
      where: { profileId, isActive: true },
    });
  }

  async findUserLinkById(id: string) {
    return prisma.backofficeBotUserLink.findUnique({
      where: { id },
      select: {
        id: true,
        profileId: true,
        normalizedPhone: true,
        linkedAt: true,
        linkedBy: true,
        authChallengeId: true,
        isActive: true,
        lastInteractionAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            supabaseId: true,
          },
        },
      },
    });
  }

  async createUserLink(input: CreateUserLinkInput) {
    return prisma.backofficeBotUserLink.create({
      data: {
        profileId: input.profileId,
        normalizedPhone: input.normalizedPhone,
        linkedBy: input.linkedBy,
        authChallengeId: input.authChallengeId ?? null,
        lastInteractionAt: new Date(),
      },
    });
  }

  async revokeUserLink(id: string) {
    return prisma.backofficeBotUserLink.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  async revokeUserLinkByProfile(profileId: string) {
    const link = await this.findActiveUserLinkByProfile(profileId);
    if (!link) {
      return null;
    }
    return this.revokeUserLink(link.id);
  }

  async listUserLinks(pagination: { page: number; pageSize: number }) {
    const skip = (pagination.page - 1) * pagination.pageSize;
    const where: Prisma.BackofficeBotUserLinkWhereInput = { isActive: true };

    const [items, totalItems] = await Promise.all([
      prisma.backofficeBotUserLink.findMany({
        where,
        select: {
          id: true,
          profileId: true,
          normalizedPhone: true,
          linkedAt: true,
          linkedBy: true,
          authChallengeId: true,
          isActive: true,
          lastInteractionAt: true,
          revokedAt: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileIconUrl: true,
              supabaseId: true,
            },
          },
        },
        orderBy: { linkedAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.backofficeBotUserLink.count({ where }),
    ]);

    return { items, totalItems };
  }

  async touchUserLinkInteraction(id: string) {
    await prisma.backofficeBotUserLink.update({
      where: { id },
      data: { lastInteractionAt: new Date() },
    });
  }

  async findActiveSession(userLinkId: string) {
    return prisma.backofficeBotSession.findFirst({
      where: {
        userLinkId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsertSession(data: {
    userLinkId: string;
    teamId: string;
    currentLeadId?: string | null;
    flowId?: string | null;
    flowStep?: string | null;
    flowStack?: Prisma.InputJsonValue;
    expiresAt: Date;
  }) {
    const existing = await this.findActiveSession(data.userLinkId);
    if (existing) {
      return prisma.backofficeBotSession.update({
        where: { id: existing.id },
        data: {
          teamId: data.teamId,
          currentLeadId: data.currentLeadId,
          flowId: data.flowId,
          flowStep: data.flowStep,
          flowStack: data.flowStack,
          expiresAt: data.expiresAt,
        },
      });
    }

    return prisma.backofficeBotSession.create({
      data: {
        userLinkId: data.userLinkId,
        teamId: data.teamId,
        currentLeadId: data.currentLeadId ?? null,
        flowId: data.flowId ?? null,
        flowStep: data.flowStep ?? null,
        flowStack: data.flowStack ?? [],
        expiresAt: data.expiresAt,
      },
    });
  }

  async clearExpiredSessions() {
    const result = await prisma.backofficeBotSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  async createMessage(input: CreateMessageInput) {
    return prisma.backofficeBotMessage.create({
      data: {
        channelId: input.channelId,
        userLinkId: input.userLinkId ?? null,
        direction: input.direction,
        channelMessageId: input.channelMessageId ?? null,
        flowId: input.flowId ?? null,
        errorCode: input.errorCode ?? null,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  async findMessageByChannelMessageId(channelMessageId: string) {
    return prisma.backofficeBotMessage.findUnique({
      where: { channelMessageId },
    });
  }

  async listMessagesByUserLink(userLinkId: string, pagination: { before?: Date; limit: number }) {
    return prisma.backofficeBotMessage.findMany({
      where: {
        userLinkId,
        ...(pagination.before ? { createdAt: { lt: pagination.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: pagination.limit,
    });
  }

  async listConversations(
    filters: ListConversationsFilters,
    pagination: { page: number; pageSize: number }
  ) {
    const where: Prisma.BackofficeBotUserLinkWhereInput = {
      isActive: true,
      ...buildConversationSearchWhere(filters.search),
    };

    if (filters.dateFrom || filters.dateTo) {
      where.lastInteractionAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const skip = (pagination.page - 1) * pagination.pageSize;
    const links = await prisma.backofficeBotUserLink.findMany({
      where,
      select: {
        id: true,
        profileId: true,
        normalizedPhone: true,
        linkedAt: true,
        lastInteractionAt: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            direction: true,
            payload: true,
          },
        },
      },
      orderBy: { lastInteractionAt: "desc" },
      skip,
      take: pagination.pageSize,
    });

    const totalItems = await prisma.backofficeBotUserLink.count({ where });

    const items = links.map((link) => {
      const lastMessage = link.messages[0] ?? null;
      const payload = lastMessage?.payload as { contentText?: string } | null;
      return {
        userLinkId: link.id,
        profileId: link.profileId,
        normalizedPhone: link.normalizedPhone,
        linkedAt: link.linkedAt,
        lastInteractionAt: link.lastInteractionAt,
        profileFullName: link.profile.fullName,
        profileEmail: link.profile.email,
        profileIconUrl: link.profile.profileIconUrl,
        lastMessageAt: lastMessage?.createdAt ?? null,
        lastMessagePreview: payload?.contentText ?? null,
        lastMessageDirection: lastMessage?.direction ?? null,
      };
    });

    return { items, totalItems };
  }

  async listNotificationPreferences(profileId: string) {
    return prisma.backofficeBotNotificationPreference.findMany({
      where: { profileId },
      orderBy: { type: "asc" },
    });
  }

  async findNotificationPreference(profileId: string, type: string) {
    return prisma.backofficeBotNotificationPreference.findUnique({
      where: { profileId_type: { profileId, type } },
    });
  }

  async resolvePushPhoneForProfile(profileId: string): Promise<string | null> {
    const link = await this.findActiveUserLinkByProfile(profileId);
    if (link?.normalizedPhone) {
      return link.normalizedPhone;
    }

    return this.resolveProfilePhone(profileId);
  }

  async resolveProfilePhone(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { phone: true },
    });

    if (!profile?.phone) {
      return null;
    }

    return normalizePhoneE164(profile.phone);
  }

  async findLastInboundAtByPhone(normalizedPhone: string): Promise<Date | null> {
    const message = await prisma.backofficeBotMessage.findFirst({
      where: {
        direction: "inbound",
        userLink: { normalizedPhone },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return message?.createdAt ?? null;
  }

  async upsertNotificationPreference(
    profileId: string,
    type: string,
    enabled: boolean,
    quietHours?: Prisma.InputJsonValue
  ) {
    return prisma.backofficeBotNotificationPreference.upsert({
      where: { profileId_type: { profileId, type } },
      create: { profileId, type, enabled, quietHours },
      update: { enabled, quietHours },
    });
  }

  async createOutboxEvent(input: CreateOutboxEventInput) {
    return prisma.backofficeBotEventOutbox.create({
      data: {
        eventType: input.eventType,
        profileId: input.profileId,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async findOutboxEventByIdempotencyKey(key: string) {
    return prisma.backofficeBotEventOutbox.findUnique({
      where: { idempotencyKey: key },
    });
  }

  async listPendingOutboxEvents(limit: number) {
    const now = new Date();
    return prisma.backofficeBotEventOutbox.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        attemptCount: { lt: STUDIO_BOT_OUTBOX_MAX_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async updateOutboxEventStatus(
    id: string,
    status: BackofficeBotEventOutboxStatus,
    options?: {
      sentAt?: Date | null;
      attemptCount?: number;
      nextAttemptAt?: Date | null;
      lastError?: string | null;
    }
  ) {
    return prisma.backofficeBotEventOutbox.update({
      where: { id },
      data: {
        status,
        ...(options?.sentAt !== undefined ? { sentAt: options.sentAt } : {}),
        ...(options?.attemptCount !== undefined ? { attemptCount: options.attemptCount } : {}),
        ...(options?.nextAttemptAt !== undefined ? { nextAttemptAt: options.nextAttemptAt } : {}),
        ...(options?.lastError !== undefined ? { lastError: options.lastError } : {}),
      },
    });
  }

  async countSentOutboxEventsForProfileSince(profileId: string, since: Date) {
    return prisma.backofficeBotEventOutbox.count({
      where: {
        profileId,
        status: "sent",
        sentAt: { gte: since },
      },
    });
  }
}

function cryptoRandomSecret(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

export const backofficeBotRepository = new PrismaBackofficeBotRepository();
