export type {
  CreateStudioWebhookRequestLogInput,
  ListLatestWebhookRequestLogsParams,
  ListLatestWebhookRequestLogsResult,
  StudioWebhookConfigSnapshot,
  StudioWebhookRequestLogResultType,
  StudioWebhookRequestLogSnapshot,
  StudioWebhookTeamSnapshot,
  UpsertStudioWebhookConfigInput,
} from "@/app/api/infra/data/repositories/studioWebhook/IStudioWebhookConfigRepository";

import type {
  CreateStudioWebhookRequestLogInput,
  ListLatestWebhookRequestLogsParams,
  ListLatestWebhookRequestLogsResult,
  StudioWebhookConfigSnapshot,
  StudioWebhookTeamSnapshot,
  UpsertStudioWebhookConfigInput,
} from "@/app/api/infra/data/repositories/studioWebhook/IStudioWebhookConfigRepository";

/**
 * R10-6 (revisão Opus, Protocolo 96) — os tipos agora moram no Repository
 * (`IStudioWebhookConfigRepository`); esta interface só os reexporta para
 * não quebrar o UseCase e os testes existentes que importam daqui.
 */
export interface IStudioWebhookIntegrationService {
  getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null>;
  getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null>;
  upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot>;
  touchWebhookLastUsed(teamId: string): Promise<void>;
  createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void>;
  /** SPEC 10, W32: paginação real (page/pageSize) — antes fixo nos 15 mais recentes. */
  listLatestWebhookRequestLogs(
    teamId: string,
    params: ListLatestWebhookRequestLogsParams
  ): Promise<ListLatestWebhookRequestLogsResult>;
}
