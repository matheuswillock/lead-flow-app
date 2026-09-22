import { StudioWebhookTokenExpiryMode } from "@prisma/client";

/**
 * R10-6 (revisão Opus, Protocolo 96) — `StudioWebhookIntegrationService`
 * chamava `prisma` diretamente (era uma exceção legada em
 * `nonRepositoryDatabaseAccessAllowlist`). A SPEC 10 tocou esse arquivo
 * (W32, paginação de logs) e, por CLAUDE.md ("Touching a file listed in
 * ... legacy exception ... MUST trigger an immediate refactor"), o acesso a
 * dado migrou para cá. Os tipos moram no Repository (camada mais baixa) e a
 * interface da Service (`IStudioWebhookIntegrationService`) os reexporta —
 * nunca o contrário, para não recriar o mesmo achado de "Service importado
 * fora de UseCase" que o `governance:check` já reprova.
 */
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

export type ListLatestWebhookRequestLogsParams = {
  page: number;
  pageSize: number;
};

export type ListLatestWebhookRequestLogsResult = {
  items: StudioWebhookRequestLogSnapshot[];
  total: number;
};

export interface IStudioWebhookConfigRepository {
  getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null>;
  getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null>;
  upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot>;
  touchWebhookLastUsed(teamId: string): Promise<void>;
  createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void>;
  listLatestWebhookRequestLogs(
    teamId: string,
    params: ListLatestWebhookRequestLogsParams
  ): Promise<ListLatestWebhookRequestLogsResult>;
}
