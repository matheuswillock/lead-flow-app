import type {
  BackofficeBotAuthChallenge,
  BackofficeBotAuthChallengeSource,
  BackofficeBotAuthChallengeStatus,
  BackofficeBotChannel,
  BackofficeBotChannelStatus,
  BackofficeBotEventOutbox,
  BackofficeBotEventOutboxStatus,
  BackofficeBotMessage,
  BackofficeBotMessageDirection,
  BackofficeBotNotificationPreference,
  BackofficeBotSession,
  BackofficeBotUserLink,
  BackofficeBotUserLinkSource,
  Prisma,
  UserFunction,
  UserRole,
} from "@prisma/client";
import type { BotMessagePayload } from "@/lib/studio-bot/types";

export type BackofficeBotUserLinkWithProfile = BackofficeBotUserLink & {
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    profileIconUrl: string | null;
    supabaseId: string | null;
  };
};

export type BackofficeBotConversationSummary = {
  userLinkId: string;
  profileId: string;
  normalizedPhone: string;
  linkedAt: Date;
  lastInteractionAt: Date | null;
  profileFullName: string | null;
  profileEmail: string | null;
  profileIconUrl: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageDirection: BackofficeBotMessageDirection | null;
};

export interface CreateAuthChallengeInput {
  source: BackofficeBotAuthChallengeSource;
  codeHash: string;
  expiresAt: Date;
  normalizedPhone?: string | null;
  emailRequested?: string | null;
  profileId?: string | null;
  ipMetadata?: Prisma.InputJsonValue;
}

export interface CreateUserLinkInput {
  profileId: string;
  normalizedPhone: string;
  linkedBy: BackofficeBotUserLinkSource;
  authChallengeId?: string | null;
}

export interface CreateMessageInput {
  channelId: string;
  userLinkId?: string | null;
  direction: BackofficeBotMessageDirection;
  channelMessageId?: string | null;
  flowId?: string | null;
  errorCode?: string | null;
  payload: BotMessagePayload;
}

export interface CreateOutboxEventInput {
  eventType: string;
  profileId: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
}

export interface ListConversationsFilters {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IBackofficeBotRepository {
  findProfileActiveTeam(profileId: string): Promise<{ id: string; activeTeamId: string | null } | null>;
  findProfileByEmail(email: string): Promise<{ id: string; activeTeamId: string | null; email: string } | null>;
  findProfileBotContext(profileId: string): Promise<{
    id: string;
    fullName: string | null;
    activeTeamId: string | null;
    isMaster: boolean;
  } | null>;
  findTeamMemberForBot(
    teamId: string,
    profileId: string
  ): Promise<{ role: UserRole; functions: UserFunction[] } | null>;
  findTeamName(teamId: string): Promise<{ id: string; name: string } | null>;
  findPendingWebOtpChallenges(limit?: number): Promise<BackofficeBotAuthChallenge[]>;

  getActiveChannel(): Promise<BackofficeBotChannel | null>;
  findChannelById(channelId: string): Promise<BackofficeBotChannel | null>;
  upsertChannel(data: {
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
  }): Promise<BackofficeBotChannel>;
  updateChannelProfile(
    channelId: string,
    data: {
      displayName?: string;
      aboutText?: string | null;
      avatarUrl?: string | null;
      avatarStoragePath?: string | null;
      lastProfileSyncAt?: Date | null;
    }
  ): Promise<BackofficeBotChannel>;

  createAuthChallenge(input: CreateAuthChallengeInput): Promise<BackofficeBotAuthChallenge>;
  findAuthChallengeById(id: string): Promise<BackofficeBotAuthChallenge | null>;
  findPendingChallengeByPhone(normalizedPhone: string): Promise<BackofficeBotAuthChallenge | null>;
  findPendingChallengeByProfile(profileId: string): Promise<BackofficeBotAuthChallenge | null>;
  expirePendingChallengesForProfile(profileId: string): Promise<number>;
  expirePendingChallengesForPhone(normalizedPhone: string): Promise<number>;
  incrementChallengeAttempt(id: string): Promise<BackofficeBotAuthChallenge>;
  updateChallengeStatus(
    id: string,
    status: BackofficeBotAuthChallengeStatus,
    data?: { verifiedAt?: Date; profileId?: string; normalizedPhone?: string }
  ): Promise<BackofficeBotAuthChallenge>;
  countRecentChallengesForProfile(profileId: string, since: Date): Promise<number>;
  listAuthChallenges(
    filters: { source?: BackofficeBotAuthChallengeSource; status?: BackofficeBotAuthChallengeStatus },
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeBotAuthChallenge[]; totalItems: number }>;

  findActiveUserLinkByPhone(normalizedPhone: string): Promise<BackofficeBotUserLinkWithProfile | null>;
  findActiveUserLinkByProfile(profileId: string): Promise<BackofficeBotUserLink | null>;
  findUserLinkById(id: string): Promise<BackofficeBotUserLinkWithProfile | null>;
  createUserLink(input: CreateUserLinkInput): Promise<BackofficeBotUserLink>;
  revokeUserLink(id: string): Promise<BackofficeBotUserLink>;
  revokeUserLinkByProfile(profileId: string): Promise<BackofficeBotUserLink | null>;
  listUserLinks(
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeBotUserLinkWithProfile[]; totalItems: number }>;
  touchUserLinkInteraction(id: string): Promise<void>;

  findActiveSession(userLinkId: string): Promise<BackofficeBotSession | null>;
  upsertSession(data: {
    userLinkId: string;
    teamId: string;
    currentLeadId?: string | null;
    flowId?: string | null;
    flowStep?: string | null;
    flowStack?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<BackofficeBotSession>;
  clearExpiredSessions(): Promise<number>;

  createMessage(input: CreateMessageInput): Promise<BackofficeBotMessage>;
  findMessageByChannelMessageId(channelMessageId: string): Promise<BackofficeBotMessage | null>;
  listMessagesByUserLink(
    userLinkId: string,
    pagination: { before?: Date; limit: number }
  ): Promise<BackofficeBotMessage[]>;
  listConversations(
    filters: ListConversationsFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeBotConversationSummary[]; totalItems: number }>;

  listNotificationPreferences(profileId: string): Promise<BackofficeBotNotificationPreference[]>;
  findNotificationPreference(
    profileId: string,
    type: string
  ): Promise<BackofficeBotNotificationPreference | null>;
  resolvePushPhoneForProfile(profileId: string): Promise<string | null>;
  findLastInboundAtByPhone(normalizedPhone: string): Promise<Date | null>;
  upsertNotificationPreference(
    profileId: string,
    type: string,
    enabled: boolean,
    quietHours?: Prisma.InputJsonValue
  ): Promise<BackofficeBotNotificationPreference>;

  createOutboxEvent(input: CreateOutboxEventInput): Promise<BackofficeBotEventOutbox>;
  findOutboxEventByIdempotencyKey(key: string): Promise<BackofficeBotEventOutbox | null>;
  listPendingOutboxEvents(limit: number): Promise<BackofficeBotEventOutbox[]>;
  updateOutboxEventStatus(
    id: string,
    status: BackofficeBotEventOutboxStatus,
    sentAt?: Date
  ): Promise<BackofficeBotEventOutbox>;
  countSentOutboxEventsForProfileSince(profileId: string, since: Date): Promise<number>;
}
