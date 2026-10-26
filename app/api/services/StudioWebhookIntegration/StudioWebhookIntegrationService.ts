import { studioWebhookConfigRepository } from "@/app/api/infra/data/repositories/studioWebhook/StudioWebhookConfigRepository";
import type { IStudioWebhookConfigRepository } from "@/app/api/infra/data/repositories/studioWebhook/IStudioWebhookConfigRepository";
import type {
  CreateStudioWebhookRequestLogInput,
  IStudioWebhookIntegrationService,
  ListLatestWebhookRequestLogsParams,
  ListLatestWebhookRequestLogsResult,
  StudioWebhookConfigSnapshot,
  StudioWebhookTeamSnapshot,
  UpsertStudioWebhookConfigInput,
} from "./IStudioWebhookIntegrationService";

/**
 * R10-6 (revisão Opus, Protocolo 96) — esta Service chamava `prisma`
 * diretamente (exceção legada em `nonRepositoryDatabaseAccessAllowlist`).
 * A SPEC 10 tocou o arquivo (W32) e, por CLAUDE.md, isso obriga o refactor
 * na mesma mudança: o acesso a dado migrou para
 * `StudioWebhookConfigRepository`, e esta classe passou a ser um
 * repasse fino (`Route -> UseCase -> Service -> Repository -> Prisma`),
 * preservando a interface pública para não quebrar o UseCase nem os
 * testes que já mockam `IStudioWebhookIntegrationService`.
 */
export class StudioWebhookIntegrationService implements IStudioWebhookIntegrationService {
  constructor(private readonly repository: IStudioWebhookConfigRepository = studioWebhookConfigRepository) {}

  async getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null> {
    return this.repository.getTeamWithMaster(teamId);
  }

  async getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null> {
    return this.repository.getWebhookConfigByTeamId(teamId);
  }

  async upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot> {
    return this.repository.upsertWebhookConfig(input);
  }

  async touchWebhookLastUsed(teamId: string): Promise<void> {
    await this.repository.touchWebhookLastUsed(teamId);
  }

  async createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void> {
    await this.repository.createWebhookRequestLog(input);
  }

  async listLatestWebhookRequestLogs(
    teamId: string,
    params: ListLatestWebhookRequestLogsParams
  ): Promise<ListLatestWebhookRequestLogsResult> {
    return this.repository.listLatestWebhookRequestLogs(teamId, params);
  }
}

export const studioWebhookIntegrationService = new StudioWebhookIntegrationService();
