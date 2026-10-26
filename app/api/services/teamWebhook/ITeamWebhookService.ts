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
  /** Versão do contrato de entrada (1 ou 2); só faz sentido para webhook de entrada. */
  contractVersion: number;
  /** SPEC 11 (v2): escopos do token, SDRs padrão em rodízio, último atendido e link de Meet padrão. */
  scopes: string[];
  defaultAssigneeProfileIds: string[];
  lastAssignedProfileId: string | null;
  defaultMeetingLink: string | null;
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
  signingSecretPreview: string | null;
  expiryMode: StudioWebhookTokenExpiryMode | null;
  expiresAt: string | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateInboundWebhookInput = {
  direction: "inbound";
  name: string;
  // SPEC 10, DA4/A-E4: "none" saiu da API de criação/edição.
  tokenMode: "manual" | "auto";
  manualToken?: string;
  expiryMode: StudioWebhookTokenExpiryMode;
  /** Ausente = v1 (comportamento de sempre). */
  contractVersion?: 1 | 2;
  /** v2: `leads_create` (obrigatório) e `leads_schedule`. */
  scopes?: Array<"leads_create" | "leads_schedule">;
  /** v2: SDRs padrão em rodízio, na ordem. Obrigatório com pelo menos um. */
  defaultAssigneeProfileIds?: string[];
  /** v2: link de Meet (https) para reunião online de closer sem Google. */
  defaultMeetingLink?: string | null;
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
  // SPEC 10, DA4/A-E4: "none" saiu da API de criação/edição.
  tokenMode?: "manual" | "auto";
  manualToken?: string;
  expiryMode?: StudioWebhookTokenExpiryMode;
};

export type TeamWebhookStatusAction =
  | { status: "active" | "disabled" }
  | { action: "reactivate" };

export interface ITeamWebhookService {
  list(
    access: TeamAccess,
    params: {
      direction: TeamWebhookDirection;
      status?: TeamWebhookStatus;
      search?: string;
      page: number;
      pageSize: number;
    },
    appUrl: string
  ): Promise<{ items: TeamWebhookSummaryDto[]; total: number; page: number; pageSize: number }>;
  getById(access: TeamAccess, id: string, appUrl: string): Promise<TeamWebhookSummaryDto | null>;
  create(
    access: TeamAccess,
    input: CreateInboundWebhookInput | CreateOutboundWebhookInput,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto & { token?: string; signingSecret?: string }>;
  update(
    access: TeamAccess,
    id: string,
    input: UpdateTeamWebhookInput,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto & { token?: string }>;
  rotateSigningSecret(
    access: TeamAccess,
    id: string,
    appUrl: string
  ): Promise<TeamWebhookSummaryDto & { signingSecret: string }>;
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
