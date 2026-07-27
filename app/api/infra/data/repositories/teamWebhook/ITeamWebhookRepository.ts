import type {
  Prisma,
  StudioWebhookTokenExpiryMode,
  TeamWebhook,
  TeamWebhookDestinationPreset,
  TeamWebhookDirection,
  TeamWebhookEventKey,
  TeamWebhookStatus,
} from "@prisma/client";

export type TeamWebhookTeamContext = {
  profileId: string;
  teamId: string;
};

export type CreateTeamWebhookData = {
  direction: TeamWebhookDirection;
  name: string;
  status?: TeamWebhookStatus;
  targetUrl?: string | null;
  destinationPreset?: TeamWebhookDestinationPreset | null;
  selectedEvents?: TeamWebhookEventKey[];
  failureThreshold?: number;
  tokenHash?: string | null;
  tokenCipher?: string | null;
  tokenPreview?: string | null;
  expiryMode?: StudioWebhookTokenExpiryMode | null;
  expiresAt?: Date | null;
};

export type UpdateTeamWebhookData = Partial<CreateTeamWebhookData> & {
  failureStreak?: number;
  pausedAt?: Date | null;
  pauseReason?: string | null;
  lastUsedAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
};

export type ListTeamWebhooksParams = {
  direction: TeamWebhookDirection;
  status?: TeamWebhookStatus;
  page: number;
  pageSize: number;
};

export type TeamWebhookSelect = {
  id: true;
  teamId: true;
  direction: true;
  status: true;
  name: true;
  targetUrl: true;
  destinationPreset: true;
  selectedEvents: true;
  failureStreak: true;
  failureThreshold: true;
  pausedAt: true;
  pauseReason: true;
  tokenHash: true;
  tokenCipher: true;
  tokenPreview: true;
  expiryMode: true;
  expiresAt: true;
  lastUsedAt: true;
  lastSuccessAt: true;
  lastFailureAt: true;
  updatedByProfileId: true;
  createdAt: true;
  updatedAt: true;
};

export const TEAM_WEBHOOK_SELECT = {
  id: true,
  teamId: true,
  direction: true,
  status: true,
  name: true,
  targetUrl: true,
  destinationPreset: true,
  selectedEvents: true,
  failureStreak: true,
  failureThreshold: true,
  pausedAt: true,
  pauseReason: true,
  tokenHash: true,
  tokenCipher: true,
  tokenPreview: true,
  expiryMode: true,
  expiresAt: true,
  lastUsedAt: true,
  lastSuccessAt: true,
  lastFailureAt: true,
  updatedByProfileId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies TeamWebhookSelect;

export type TeamWebhookRow = Prisma.TeamWebhookGetPayload<{ select: typeof TEAM_WEBHOOK_SELECT }>;

export interface ITeamWebhookRepository {
  listWithCtx(
    ctx: TeamWebhookTeamContext,
    params: ListTeamWebhooksParams
  ): Promise<{ items: TeamWebhookRow[]; total: number }>;
  findByIdWithCtx(ctx: TeamWebhookTeamContext, id: string): Promise<TeamWebhookRow | null>;
  findInboundByTeamId(teamId: string): Promise<TeamWebhookRow | null>;
  createWithCtx(ctx: TeamWebhookTeamContext, data: CreateTeamWebhookData): Promise<TeamWebhookRow>;
  updateWithCtx(
    ctx: TeamWebhookTeamContext,
    id: string,
    data: UpdateTeamWebhookData
  ): Promise<TeamWebhookRow>;
  setStatusWithCtx(
    ctx: TeamWebhookTeamContext,
    id: string,
    status: TeamWebhookStatus,
    pauseReason?: string | null
  ): Promise<TeamWebhookRow>;
  countOutboundWithCtx(ctx: TeamWebhookTeamContext): Promise<number>;
  findActiveOutboundForEvent(
    teamId: string,
    eventKey: TeamWebhookEventKey
  ): Promise<
    Array<{
      id: string;
      teamId: string;
      targetUrl: string;
      destinationPreset: TeamWebhookDestinationPreset;
      failureStreak: number;
      failureThreshold: number;
      name: string;
    }>
  >;
  incrementFailureStreak(webhookId: string): Promise<TeamWebhook>;
  resetFailureStreak(webhookId: string): Promise<void>;
  markPausedByFailures(webhookId: string): Promise<TeamWebhook>;
  findForDelivery(webhookId: string): Promise<{
    id: string;
    teamId: string;
    status: TeamWebhookStatus;
    name: string;
    targetUrl: string | null;
    destinationPreset: TeamWebhookDestinationPreset | null;
    failureStreak: number;
    failureThreshold: number;
    updatedByProfileId: string;
  } | null>;
  findTeamMasterId(teamId: string): Promise<string | null>;
  createAutoPausedNotification(input: {
    recipientProfileId: string;
    teamId: string;
    webhookId: string;
    webhookName: string;
  }): Promise<void>;
}
