import type {
  StudioWebhookTokenExpiryMode,
  TeamWebhookDestinationPreset,
  TeamWebhookDirection,
  TeamWebhookEventKey,
  TeamWebhookStatus,
} from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { TeamWebhookRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository";
import type { TeamWebhookEventLogRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookEventLogRepository";

export type TeamWebhookSummaryDto = {
  id: string;
  direction: TeamWebhookDirection;
  status: TeamWebhookStatus;
  name: string;
  targetUrl: string | null;
  destinationPreset: TeamWebhookDestinationPreset | null;
  selectedEvents: TeamWebhookEventKey[];
  failureStreak: number;
  failureThreshold: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  tokenPreview: string | null;
  expiryMode: StudioWebhookTokenExpiryMode | null;
  expiresAt: string | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateInboundWebhookInput = {
  direction: "inbound";
  name: string;
  tokenMode: "manual" | "auto" | "none";
  manualToken?: string;
  expiryMode: StudioWebhookTokenExpiryMode;
};

export type CreateOutboundWebhookInput = {
  direction: "outbound";
  name: string;
  targetUrl: string;
  destinationPreset: TeamWebhookDestinationPreset;
  selectedEvents: TeamWebhookEventKey[];
  failureThreshold?: number;
};

export type UpdateTeamWebhookInput = {
  name?: string;
  targetUrl?: string;
  destinationPreset?: TeamWebhookDestinationPreset;
  selectedEvents?: TeamWebhookEventKey[];
  failureThreshold?: number;
  tokenMode?: "manual" | "auto" | "none";
  manualToken?: string;
  expiryMode?: StudioWebhookTokenExpiryMode;
};

export type TeamWebhookStatusAction =
  | { status: "active" | "disabled" }
  | { action: "reactivate" };

export interface ITeamWebhookService {
  list(
    access: TeamAccess,
    params: { direction: TeamWebhookDirection; status?: TeamWebhookStatus; page: number; pageSize: number },
    appUrl: string
  ): Promise<{ items: TeamWebhookSummaryDto[]; total: number; page: number; pageSize: number }>;
  getById(access: TeamAccess, id: string, appUrl: string): Promise<TeamWebhookSummaryDto | null>;
  create(
    access: TeamAccess,
    input: CreateInboundWebhookInput | CreateOutboundWebhookInput,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto & { token?: string }>;
  update(
    access: TeamAccess,
    id: string,
    input: UpdateTeamWebhookInput,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto & { token?: string }>;
  changeStatus(
    access: TeamAccess,
    id: string,
    action: TeamWebhookStatusAction,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto>;
  listLogs(
    access: TeamAccess,
    id: string,
    params: { page: number; pageSize: number; result?: "success" | "failure" | "rejected" }
  ): Promise<{ items: TeamWebhookEventLogRow[]; total: number; page: number; pageSize: number }>;
  testDelivery(access: TeamAccess, id: string): Promise<{ ok: boolean; statusCode: number | null; errorMessage: string | null }>;
  toSummary(row: TeamWebhookRow, appUrl: string, token?: string): TeamWebhookSummaryDto;
}
