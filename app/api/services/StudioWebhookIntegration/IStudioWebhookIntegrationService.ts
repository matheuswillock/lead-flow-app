import { StudioWebhookTokenExpiryMode } from "@prisma/client";

export type StudioWebhookTeamSnapshot = {
  id: string;
  masterId: string;
  master: {
    id: string;
    supabaseId: string | null;
  };
};

export type StudioWebhookConfigSnapshot = {
  id: string;
  teamId: string;
  tokenHash: string;
  tokenCipher: string | null;
  tokenPreview: string;
  expiryMode: StudioWebhookTokenExpiryMode;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  updatedByProfileId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertStudioWebhookConfigInput = {
  teamId: string;
  tokenHash: string;
  tokenCipher: string | null;
  tokenPreview: string;
  expiryMode: StudioWebhookTokenExpiryMode;
  expiresAt: Date | null;
  updatedByProfileId: string;
};

export type StudioWebhookRequestLogResultType = "success" | "error";

export type CreateStudioWebhookRequestLogInput = {
  teamId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  resultType: StudioWebhookRequestLogResultType;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
};

export type StudioWebhookRequestLogSnapshot = {
  id: string;
  teamId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  resultType: string;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  createdAt: Date;
};

export interface IStudioWebhookIntegrationService {
  getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null>;
  getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null>;
  upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot>;
  touchWebhookLastUsed(teamId: string): Promise<void>;
  createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void>;
  listLatestWebhookRequestLogs(teamId: string, limit: number): Promise<StudioWebhookRequestLogSnapshot[]>;
}
