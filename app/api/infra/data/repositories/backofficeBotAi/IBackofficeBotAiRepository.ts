import type {
  BackofficeBotAiAttempt,
  BackofficeBotAiAttemptStatus,
  BackofficeBotAiCapability,
  BackofficeBotAiConfiguration,
  BackofficeBotAiDailyUsage,
  BackofficeBotAiInteraction,
  BackofficeBotAiInteractionStatus,
  BackofficeBotAiProvider,
  Prisma,
} from "@prisma/client";

export type CreateInteractionInput = {
  inboundMessageId?: string | null;
  userLinkId?: string | null;
  profileId?: string | null;
  sessionId?: string | null;
  teamIdSnapshot?: string | null;
  capability: BackofficeBotAiCapability;
  status: BackofficeBotAiInteractionStatus;
  intent?: string | null;
  confidence?: number | null;
  promptKey?: string | null;
  promptVersion?: string;
  isShadow?: boolean;
  usedFallback?: boolean;
  inputHash?: string | null;
  outputHash?: string | null;
  errorCode?: string | null;
  latencyMs?: number | null;
};

export type CreateAttemptInput = {
  interactionId: string;
  sequence: number;
  provider: BackofficeBotAiProvider;
  model: string;
  capability: BackofficeBotAiCapability;
  status: BackofficeBotAiAttemptStatus;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  providerRequestId?: string | null;
  requestSchemaVersion?: string | null;
  responseSchemaVersion?: string | null;
};

export interface IBackofficeBotAiRepository {
  getConfiguration(): Promise<BackofficeBotAiConfiguration>;
  updateConfiguration(
    data: Prisma.BackofficeBotAiConfigurationUncheckedUpdateInput,
    updatedByProfileId: string
  ): Promise<BackofficeBotAiConfiguration>;
  createInteraction(input: CreateInteractionInput): Promise<BackofficeBotAiInteraction>;
  createAttempt(input: CreateAttemptInput): Promise<BackofficeBotAiAttempt>;
  countAttemptsToday(): Promise<number>;
  countAttemptsTodayForUser(userLinkId: string): Promise<number>;
  countInteractions(from: Date, to: Date): Promise<number>;
  countAttemptsByStatus(from: Date, to: Date): Promise<Array<{ status: BackofficeBotAiAttemptStatus; _count: number }>>;
  listAttempts(input: {
    from: Date;
    to: Date;
    page: number;
    pageSize: number;
    provider?: BackofficeBotAiProvider;
    model?: string;
    status?: BackofficeBotAiAttemptStatus;
  }): Promise<{ items: BackofficeBotAiAttempt[]; total: number }>;
  listUsersUsage(input: {
    from: Date;
    to: Date;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<{
      profileId: string | null;
      userLinkId: string | null;
      calls: number;
      lastAt: Date;
    }>;
    total: number;
  }>;
  findInteractionById(id: string): Promise<
    | (BackofficeBotAiInteraction & {
        attempts: BackofficeBotAiAttempt[];
      })
    | null
  >;
  upsertDailyUsage(input: {
    day: Date;
    provider: BackofficeBotAiProvider;
    model: string;
    capability: BackofficeBotAiCapability;
    requests: number;
    successes: number;
    failures: number;
    fallbacks: number;
    inputTokens: bigint;
    outputTokens: bigint;
    estimatedCostUsd: number;
    uniqueUsers: number;
    latencyP50Ms?: number | null;
    latencyP95Ms?: number | null;
  }): Promise<BackofficeBotAiDailyUsage>;
  listDailyUsage(from: Date, to: Date): Promise<BackofficeBotAiDailyUsage[]>;
  deleteOldInteractions(before: Date): Promise<number>;
}
