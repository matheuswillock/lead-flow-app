import { Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import {
  buildStudioWebhookTokenPreview,
  computeStudioWebhookTokenExpiry,
  decryptStudioWebhookToken,
  encryptStudioWebhookToken,
  generateStudioWebhookToken,
  hashStudioWebhookToken,
  isStudioWebhookTokenExpired,
  safeStudioWebhookTokenEquals,
} from "@/lib/webhooks/studioWebhookSecurity";
import {
  type GetStudioWebhookLogsUseCaseInput,
  IStudioWebhookIntegrationUseCase,
  type GetStudioWebhookConfigUseCaseInput,
  type ProcessStudioWebhookLeadInput,
  type RegisterStudioWebhookRequestLogUseCaseInput,
  type StudioWebhookTokenMode,
  type UpsertStudioWebhookConfigUseCaseInput,
} from "./IStudioWebhookIntegrationUseCase";
import {
  type IStudioWebhookIntegrationService,
} from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";
import { studioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/StudioWebhookIntegrationService";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { teamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository";
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher";

const UNAUTHORIZED_ERROR = "Webhook token não autorizado";
const TOKEN_EXPIRED_ERROR = "Webhook token expirado";
const WEBHOOK_INACTIVE_ERROR = "Webhook de entrada inativo ou pausado";
const NO_TOKEN_SENTINEL = "__studio_webhook_no_token__";
const NO_TOKEN_PREVIEW = "Sem token";
const STUDIO_WEBHOOK_LOG_LIMIT = 15;
const NONE_TOKEN_HASH = hashStudioWebhookToken("__none__");
const LEGACY_NONE_TOKEN_HASH = hashStudioWebhookToken(NO_TOKEN_SENTINEL);

const normalizeOptionalString = (value?: string): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeAppUrl = (value: string): string => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const isNoTokenPreview = (tokenPreview: string | null | undefined): boolean => {
  return tokenPreview === NO_TOKEN_PREVIEW;
};

const inferTokenModeFromConfig = (tokenPreview: string | null | undefined): StudioWebhookTokenMode => {
  if (isNoTokenPreview(tokenPreview)) {
    return "none";
  }

  return "auto";
};

const buildTemplateWebhookUrl = (appUrl: string, teamId: string, tokenMode: StudioWebhookTokenMode = "auto"): string => {
  const normalized = normalizeAppUrl(appUrl);

  if (tokenMode === "none") {
    return `${normalized}/api/webhooks/studio/${teamId}`;
  }

  return `${normalized}/api/webhooks/studio/${teamId}/[token]`;
};

const buildLeadFormUrl = (appUrl: string, teamId: string): string => {
  const normalized = normalizeAppUrl(appUrl);
  return `${normalized}/lead-form/${teamId}`;
};

const buildWebhookUrl = (appUrl: string, teamId: string, tokenMode: StudioWebhookTokenMode, token?: string): string => {
  const normalized = normalizeAppUrl(appUrl);

  if (tokenMode === "none") {
    return `${normalized}/api/webhooks/studio/${teamId}`;
  }

  return `${normalized}/api/webhooks/studio/${teamId}/${token ?? "[token]"}`;
};

export class StudioWebhookIntegrationUseCase implements IStudioWebhookIntegrationUseCase {
  constructor(private readonly service: IStudioWebhookIntegrationService) {}

  async verifyTeamExists(teamId: string): Promise<boolean> {
    try {
      const team = await this.service.getTeamWithMaster(teamId);
      return Boolean(team);
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao validar existência do time:", error);
      return false;
    }
  }

  async getConfiguration(input: GetStudioWebhookConfigUseCaseInput): Promise<Output> {
    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      const webhookConfig = await this.service.getWebhookConfigByTeamId(input.teamId);
      if (!webhookConfig) {
        return new Output(true, [], [], {
          configured: false,
          teamId: input.teamId,
          leadFormUrl: buildLeadFormUrl(input.appUrl, input.teamId),
          tokenMode: "auto",
          tokenPreview: null,
          expiryMode: "indeterminate",
          expiresAt: null,
          isExpired: false,
          lastUsedAt: null,
          webhookUrl: buildTemplateWebhookUrl(input.appUrl, input.teamId, "auto"),
          webhookUrlTemplate: buildTemplateWebhookUrl(input.appUrl, input.teamId, "auto"),
        });
      }

      const isExpired = isStudioWebhookTokenExpired(webhookConfig.expiresAt);
      const tokenMode = inferTokenModeFromConfig(webhookConfig.tokenPreview);
      const decryptedToken = decryptStudioWebhookToken(webhookConfig.tokenCipher);
      const webhookUrl =
        tokenMode === "none"
          ? buildWebhookUrl(input.appUrl, input.teamId, tokenMode)
          : decryptedToken
            ? buildWebhookUrl(input.appUrl, input.teamId, tokenMode, decryptedToken)
            : buildTemplateWebhookUrl(input.appUrl, input.teamId, tokenMode);

      return new Output(true, [], [], {
        configured: true,
        teamId: input.teamId,
        leadFormUrl: buildLeadFormUrl(input.appUrl, input.teamId),
        tokenMode,
        tokenPreview: webhookConfig.tokenPreview,
        expiryMode: webhookConfig.expiryMode,
        expiresAt: webhookConfig.expiresAt?.toISOString() ?? null,
        isExpired,
        lastUsedAt: webhookConfig.lastUsedAt?.toISOString() ?? null,
        webhookUrl,
        webhookUrlTemplate: buildTemplateWebhookUrl(input.appUrl, input.teamId, tokenMode),
      });
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao consultar configuração:", error);
      return new Output(false, [], ["Erro ao consultar configuração do webhook"], null);
    }
  }

  async upsertConfiguration(input: UpsertStudioWebhookConfigUseCaseInput): Promise<Output> {
    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      const token =
        input.tokenMode === "manual"
          ? normalizeOptionalString(input.manualToken)
          : input.tokenMode === "auto"
            ? generateStudioWebhookToken()
            : NO_TOKEN_SENTINEL;

      if (!token) {
        return new Output(false, [], ["Token manual é obrigatório"], null);
      }

      const tokenHash = hashStudioWebhookToken(token);
      const tokenCipher = input.tokenMode === "none" ? null : encryptStudioWebhookToken(token);
      const tokenPreview = input.tokenMode === "none" ? NO_TOKEN_PREVIEW : buildStudioWebhookTokenPreview(token);
      const expiresAt = computeStudioWebhookTokenExpiry(input.expiryMode);

      if (input.tokenMode !== "none" && !tokenCipher) {
        return new Output(false, [], ["Não foi possível proteger o token do webhook"], null);
      }

      const config = await this.service.upsertWebhookConfig({
        teamId: input.teamId,
        tokenHash,
        tokenCipher,
        tokenPreview,
        expiryMode: input.expiryMode,
        expiresAt,
        updatedByProfileId: input.updatedByProfileId,
      });

      // Dual-write para modelo unificado TeamWebhook (inbound)
      try {
        const existingInbound = await teamWebhookRepository.findInboundByTeamId(input.teamId);
        const inboundTokenHash =
          input.tokenMode === "none" ? NONE_TOKEN_HASH : tokenHash;
        if (existingInbound) {
          await teamWebhookRepository.updateWithCtx(
            { profileId: input.updatedByProfileId, teamId: input.teamId },
            existingInbound.id,
            {
              tokenHash: inboundTokenHash,
              tokenCipher,
              tokenPreview,
              expiryMode: input.expiryMode,
              expiresAt,
              status: "active",
            }
          );
        } else {
          await teamWebhookRepository.createWithCtx(
            { profileId: input.updatedByProfileId, teamId: input.teamId },
            {
              direction: "inbound",
              name: "Webhook Genérico de Leads",
              tokenHash: inboundTokenHash,
              tokenCipher,
              tokenPreview,
              expiryMode: input.expiryMode,
              expiresAt,
              status: "active",
            }
          );
        }
      } catch (dualWriteError) {
        console.error(
          "[StudioWebhookIntegrationUseCase] Dual-write TeamWebhook falhou:",
          dualWriteError
        );
      }

      return new Output(true, ["Configuração do webhook salva com sucesso"], [], {
        configured: true,
        teamId: config.teamId,
        tokenMode: input.tokenMode,
        token: input.tokenMode === "none" ? "" : token,
        tokenPreview: config.tokenPreview,
        expiryMode: config.expiryMode,
        expiresAt: config.expiresAt?.toISOString() ?? null,
        isExpired: false,
        webhookUrl: buildWebhookUrl(input.appUrl, config.teamId, input.tokenMode, token),
        webhookUrlTemplate: buildTemplateWebhookUrl(input.appUrl, config.teamId, input.tokenMode),
        lastUsedAt: config.lastUsedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao salvar configuração:", error);
      return new Output(false, [], ["Erro ao salvar configuração do webhook"], null);
    }
  }

  async processWebhookLead(input: ProcessStudioWebhookLeadInput): Promise<Output> {
    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        return new Output(false, [], [UNAUTHORIZED_ERROR], null);
      }

      const teamInbound = await teamWebhookRepository.findInboundByTeamId(input.teamId);
      if (teamInbound) {
        if (teamInbound.status === "disabled" || teamInbound.status === "paused") {
          return new Output(false, [], [WEBHOOK_INACTIVE_ERROR], null);
        }

        if (isStudioWebhookTokenExpired(teamInbound.expiresAt)) {
          return new Output(false, [], [TOKEN_EXPIRED_ERROR], null);
        }

        const isNoTokenMode =
          teamInbound.tokenHash === NONE_TOKEN_HASH ||
          teamInbound.tokenHash === LEGACY_NONE_TOKEN_HASH ||
          isNoTokenPreview(teamInbound.tokenPreview);

        if (isNoTokenMode) {
          if (normalizeOptionalString(input.token)) {
            return new Output(false, [], [UNAUTHORIZED_ERROR], null);
          }
        } else {
          const normalizedToken = normalizeOptionalString(input.token);
          if (!normalizedToken || !teamInbound.tokenHash) {
            return new Output(false, [], [UNAUTHORIZED_ERROR], null);
          }
          if (!safeStudioWebhookTokenEquals(normalizedToken, teamInbound.tokenHash)) {
            return new Output(false, [], [UNAUTHORIZED_ERROR], null);
          }
        }

        const leadResult = await this.service.createLeadFromWebhook({
          teamId: input.teamId,
          managerId: team.masterId,
          name: input.payload.name.trim(),
          email: normalizeOptionalString(input.payload.email),
          phone: normalizeOptionalString(input.payload.phone),
          cnpj: normalizeOptionalString(input.payload.cnpj),
          age: normalizeOptionalString(input.payload.ages),
          currentHealthPlan: normalizeOptionalString(input.payload.current_health_plan),
          currentValue: input.payload.current_value,
          referenceHospital: normalizeOptionalString(input.payload.reference_hospital),
          currentTreatment: normalizeOptionalString(input.payload.current_treatment),
          source: normalizeOptionalString(input.payload.source) || "studio_webhook",
          metadata: input.payload.metadata,
        });

        await teamWebhookRepository.touchUsage(teamInbound.id, true);
        await this.service.touchWebhookLastUsed(input.teamId).catch(() => undefined);

        void outboundEventPublisher.publish({
          teamId: input.teamId,
          eventKey: "lead_created",
          leadId: leadResult.id,
          payload: {
            lead: {
              id: leadResult.id,
              leadCode: leadResult.leadCode,
              name: input.payload.name.trim(),
              source: "studio_webhook",
            },
          },
        });

        return new Output(true, ["Lead criado via webhook com sucesso"], [], {
          id: leadResult.id,
          leadCode: leadResult.leadCode,
          webhookId: teamInbound.id,
        });
      }

      const config = await this.service.getWebhookConfigByTeamId(input.teamId);
      if (!config) {
        return new Output(false, [], [UNAUTHORIZED_ERROR], null);
      }

      if (isStudioWebhookTokenExpired(config.expiresAt)) {
        return new Output(false, [], [TOKEN_EXPIRED_ERROR], null);
      }

      const isNoTokenMode = isNoTokenPreview(config.tokenPreview);
      if (isNoTokenMode) {
        const unexpectedToken = normalizeOptionalString(input.token);
        if (unexpectedToken) {
          return new Output(false, [], [UNAUTHORIZED_ERROR], null);
        }
      } else {
        const normalizedToken = normalizeOptionalString(input.token);
        if (!normalizedToken) {
          return new Output(false, [], [UNAUTHORIZED_ERROR], null);
        }

        const isValidToken = safeStudioWebhookTokenEquals(normalizedToken, config.tokenHash);
        if (!isValidToken) {
          return new Output(false, [], [UNAUTHORIZED_ERROR], null);
        }
      }

      const leadResult = await this.service.createLeadFromWebhook({
        teamId: input.teamId,
        managerId: team.masterId,
        name: input.payload.name.trim(),
        email: normalizeOptionalString(input.payload.email),
        phone: normalizeOptionalString(input.payload.phone),
        cnpj: normalizeOptionalString(input.payload.cnpj),
        age: normalizeOptionalString(input.payload.ages),
        currentHealthPlan: normalizeOptionalString(input.payload.current_health_plan),
        currentValue: input.payload.current_value,
        referenceHospital: normalizeOptionalString(input.payload.reference_hospital),
        currentTreatment: normalizeOptionalString(input.payload.current_treatment),
        source: normalizeOptionalString(input.payload.source) || "studio_webhook",
        metadata: input.payload.metadata,
      });

      await this.service.touchWebhookLastUsed(input.teamId);

      return new Output(true, ["Lead criado via webhook com sucesso"], [], {
        id: leadResult.id,
        leadCode: leadResult.leadCode,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return new Output(false, [], ["Já existe um lead com este email ou CNPJ neste time"], null);
      }

      console.error("[StudioWebhookIntegrationUseCase] Erro ao processar webhook:", error);
      return new Output(false, [], ["Erro interno ao processar webhook"], null);
    }
  }

  async getLatestWebhookLogs(input: GetStudioWebhookLogsUseCaseInput): Promise<Output> {
    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      const safeLimit = Math.max(1, Math.min(input.limit ?? STUDIO_WEBHOOK_LOG_LIMIT, STUDIO_WEBHOOK_LOG_LIMIT));
      const logs = await this.service.listLatestWebhookRequestLogs(input.teamId, safeLimit);

      return new Output(true, [], [], {
        logs: logs.map((log) => ({
          id: log.id,
          teamId: log.teamId,
          method: log.method,
          endpoint: log.endpoint,
          statusCode: log.statusCode,
          resultType: log.resultType,
          requestPayload: log.requestPayload,
          responsePayload: log.responsePayload,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao listar logs do webhook:", error);
      return new Output(false, [], ["Erro ao listar logs do webhook"], null);
    }
  }

  async registerWebhookRequestLog(input: RegisterStudioWebhookRequestLogUseCaseInput): Promise<void> {
    try {
      await this.service.createWebhookRequestLog({
        teamId: input.teamId,
        method: input.method,
        endpoint: input.endpoint,
        statusCode: input.statusCode,
        resultType: input.resultType,
        requestPayload: input.requestPayload,
        responsePayload: input.responsePayload,
        errorMessage: input.errorMessage ?? null,
      });

      const inbound = await teamWebhookRepository.findInboundByTeamId(input.teamId);
      if (inbound) {
        const isRejected =
          input.statusCode === 403 ||
          (typeof input.errorMessage === "string" &&
            input.errorMessage.includes(WEBHOOK_INACTIVE_ERROR));

        await teamWebhookEventLogRepository.create({
          teamId: input.teamId,
          webhookId: inbound.id,
          direction: "inbound",
          result:
            input.resultType === "success"
              ? "success"
              : isRejected
                ? "rejected"
                : "failure",
          method: input.method,
          endpoint: input.endpoint,
          statusCode: input.statusCode,
          requestPayload: input.requestPayload,
          responsePayload: input.responsePayload,
          errorMessage: input.errorMessage ?? null,
        });
      }
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao registrar log do webhook:", error);
    }
  }
}

export const studioWebhookIntegrationUseCase = new StudioWebhookIntegrationUseCase(
  studioWebhookIntegrationService
);

export const studioWebhookErrors = {
  UNAUTHORIZED_ERROR,
  TOKEN_EXPIRED_ERROR,
  WEBHOOK_INACTIVE_ERROR,
};
