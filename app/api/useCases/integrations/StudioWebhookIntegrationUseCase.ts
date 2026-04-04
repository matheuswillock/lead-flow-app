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
  IStudioWebhookIntegrationUseCase,
  type GetStudioWebhookConfigUseCaseInput,
  type ProcessStudioWebhookLeadInput,
  type StudioWebhookTokenMode,
  type UpsertStudioWebhookConfigUseCaseInput,
} from "./IStudioWebhookIntegrationUseCase";
import {
  type IStudioWebhookIntegrationService,
} from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";
import { studioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/StudioWebhookIntegrationService";

const UNAUTHORIZED_ERROR = "Webhook token não autorizado";
const TOKEN_EXPIRED_ERROR = "Webhook token expirado";
const NO_TOKEN_SENTINEL = "__studio_webhook_no_token__";
const NO_TOKEN_PREVIEW = "Sem token";

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
}

export const studioWebhookIntegrationUseCase = new StudioWebhookIntegrationUseCase(
  studioWebhookIntegrationService
);

export const studioWebhookErrors = {
  UNAUTHORIZED_ERROR,
  TOKEN_EXPIRED_ERROR,
};
