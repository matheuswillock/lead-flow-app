import { Prisma } from "@prisma/client";
import { shortLinkService } from "@/app/api/services/shortLink/ShortLinkService";
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
  type AuthenticateInboundWebhookInput,
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
import type { TeamWebhookRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository";
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory";
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { maskSensitiveWebhookPayload } from "@/lib/webhooks/webhookPayloadMasking";

const UNAUTHORIZED_ERROR = "Webhook token não autorizado";
const TOKEN_EXPIRED_ERROR = "Webhook token expirado";
const WEBHOOK_INACTIVE_ERROR = "Webhook de entrada inativo ou pausado";
const ROTATION_REQUIRES_CONFIRMATION_ERROR = "rotation_requires_confirmation";
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

/**
 * SPEC 10, DA4/A-E4: "none" saiu da API de criação/edição
 * (`StudioWebhookTokenMode` não tem mais esse valor), mas a LEITURA ainda
 * precisa reconhecer configuração histórica em modo "Sem token" (0 medidos
 * em produção em 21/09, mas o dado pode existir) para não quebrar a tela ao
 * exibi-la. Por isso este tipo de leitura é mais largo que o de escrita.
 */
type DisplayTokenMode = StudioWebhookTokenMode | "none";

const inferTokenModeFromConfig = (tokenPreview: string | null | undefined): DisplayTokenMode => {
  if (isNoTokenPreview(tokenPreview)) {
    return "none";
  }

  return "auto";
};

/**
 * Casa um token (já normalizado) contra os `TeamWebhook` inbound candidatos
 * do time. Extraído para ser a única fonte da regra de casamento — usado
 * tanto pela autenticação pré-corpo (`authenticateInboundWebhook`, SPEC 10
 * DA2) quanto pela criação de lead (`processWebhookLead`), para as duas
 * nunca divergirem.
 */
const findMatchingInboundWebhook = (
  candidates: readonly TeamWebhookRow[],
  normalizedToken: string | undefined
): TeamWebhookRow | null => {
  if (candidates.length === 0) return null;

  if (!normalizedToken) {
    return (
      candidates.find((candidate) => {
        const isNoTokenMode =
          candidate.tokenHash === NONE_TOKEN_HASH ||
          candidate.tokenHash === LEGACY_NONE_TOKEN_HASH ||
          isNoTokenPreview(candidate.tokenPreview);
        return isNoTokenMode;
      }) ?? null
    );
  }

  return (
    candidates.find((candidate) => {
      if (!candidate.tokenHash) return false;
      const isNoTokenMode =
        candidate.tokenHash === NONE_TOKEN_HASH ||
        candidate.tokenHash === LEGACY_NONE_TOKEN_HASH ||
        isNoTokenPreview(candidate.tokenPreview);
      if (isNoTokenMode) return false;
      return safeStudioWebhookTokenEquals(normalizedToken, candidate.tokenHash);
    }) ?? null
  );
};

const buildTemplateWebhookUrl = (appUrl: string, teamId: string, tokenMode: DisplayTokenMode = "auto"): string => {
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

const buildWebhookUrl = (appUrl: string, teamId: string, tokenMode: DisplayTokenMode, token?: string): string => {
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

      const leadFormFullUrl = buildLeadFormUrl(input.appUrl, input.teamId);
      const leadFormUrl = await shortLinkService.getOrCreate({ targetUrl: leadFormFullUrl });

      // DA1: TeamWebhook (inbound) é a única fonte de verdade. O legado só é
      // consultado quando não existe NENHUM TeamWebhook inbound para o time
      // (D5 — fallback de leitura mantido até a migração oportunista dos
      // times legados).
      const inboundWebhook = await teamWebhookRepository.findInboundByTeamId(input.teamId);

      if (inboundWebhook) {
        const isExpired = isStudioWebhookTokenExpired(inboundWebhook.expiresAt);
        const tokenMode = inferTokenModeFromConfig(inboundWebhook.tokenPreview);
        const decryptedToken = decryptStudioWebhookToken(inboundWebhook.tokenCipher);
        const webhookUrl =
          tokenMode === "none"
            ? buildWebhookUrl(input.appUrl, input.teamId, tokenMode)
            : decryptedToken
              ? buildWebhookUrl(input.appUrl, input.teamId, tokenMode, decryptedToken)
              : buildTemplateWebhookUrl(input.appUrl, input.teamId, tokenMode);

        return new Output(true, [], [], {
          configured: true,
          teamId: input.teamId,
          leadFormUrl,
          tokenMode,
          tokenPreview: inboundWebhook.tokenPreview,
          expiryMode: inboundWebhook.expiryMode,
          expiresAt: inboundWebhook.expiresAt?.toISOString() ?? null,
          isExpired,
          lastUsedAt: inboundWebhook.lastUsedAt?.toISOString() ?? null,
          webhookUrl,
          webhookUrlTemplate: buildTemplateWebhookUrl(input.appUrl, input.teamId, tokenMode),
        });
      }

      const webhookConfig = await this.service.getWebhookConfigByTeamId(input.teamId);
      if (!webhookConfig) {
        return new Output(true, [], [], {
          configured: false,
          teamId: input.teamId,
          leadFormUrl,
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
        leadFormUrl,
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

      // DA1 — TeamWebhook é a única fonte de verdade e o único destino de
      // escrita para configuração nova. O dual-write com o legado saiu
      // (W8); o legado só é lido (fallback, D5) para decidir se já existe
      // configuração a rotacionar.
      const existingInbound = await teamWebhookRepository.findInboundByTeamId(input.teamId);
      const existingLegacyConfig = existingInbound
        ? null
        : await this.service.getWebhookConfigByTeamId(input.teamId);
      const hasExistingConfig = Boolean(existingInbound) || Boolean(existingLegacyConfig);

      // Rotação com configuração existente é ação explícita (W1): sem
      // confirmRotation, o PUT do widget legado não salva um token novo em
      // silêncio. O endpoint dedicado com período de graça é da [[12]].
      if (hasExistingConfig && !input.confirmRotation) {
        return new Output(false, [], [ROTATION_REQUIRES_CONFIRMATION_ERROR], {
          code: ROTATION_REQUIRES_CONFIRMATION_ERROR,
        });
      }

      const token =
        input.tokenMode === "manual"
          ? normalizeOptionalString(input.manualToken)
          : generateStudioWebhookToken();

      if (!token) {
        return new Output(false, [], ["Token manual é obrigatório"], null);
      }

      const tokenHash = hashStudioWebhookToken(token);
      const tokenCipher = encryptStudioWebhookToken(token);
      const tokenPreview = buildStudioWebhookTokenPreview(token);
      const expiresAt = computeStudioWebhookTokenExpiry(input.expiryMode);

      if (!tokenCipher) {
        return new Output(false, [], ["Não foi possível proteger o token do webhook"], null);
      }

      const ctx = { profileId: input.updatedByProfileId, teamId: input.teamId };
      const row = existingInbound
        ? await teamWebhookRepository.updateWithCtx(ctx, existingInbound.id, {
            tokenHash,
            tokenCipher,
            tokenPreview,
            expiryMode: input.expiryMode,
            expiresAt,
            status: "active",
          })
        : await teamWebhookRepository.createWithCtx(ctx, {
            direction: "inbound",
            name: "Webhook Genérico de Leads",
            tokenHash,
            tokenCipher,
            tokenPreview,
            expiryMode: input.expiryMode,
            expiresAt,
            status: "active",
          });

      return new Output(true, ["Configuração do webhook salva com sucesso"], [], {
        configured: true,
        teamId: row.teamId,
        tokenMode: input.tokenMode,
        token,
        tokenPreview: row.tokenPreview,
        expiryMode: row.expiryMode,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        isExpired: false,
        webhookUrl: buildWebhookUrl(input.appUrl, row.teamId, "auto", token),
        webhookUrlTemplate: buildTemplateWebhookUrl(input.appUrl, row.teamId, "auto"),
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao salvar configuração:", error);
      return new Output(false, [], ["Erro ao salvar configuração do webhook"], null);
    }
  }

  async authenticateInboundWebhook(input: AuthenticateInboundWebhookInput): Promise<Output> {
    const unauthenticated = (): Output =>
      new Output(false, [], [UNAUTHORIZED_ERROR], {
        authenticated: false,
        webhookId: null,
        supabaseId: null,
        source: null,
      });

    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        // Resposta idêntica a token errado — não revela se o time existe
        // (comportamento já confirmado como não-vulnerável na auditoria).
        return unauthenticated();
      }

      const normalizedToken = normalizeOptionalString(input.token);

      // R10-8 (revisão Opus, Protocolo 96): um token ausente OU
      // vazio/só-espaço (ex.: segmento de URL "%20") nunca deve ser tratado
      // como "modo sem token" aqui. A única rota HTTP sem token no path
      // (`[teamId]/route.ts`) já é 401 sempre (A-E4) — então esta função só
      // é chamada com um token de verdade vindo da rota `[token]`. Um
      // `input.token` presente mas normalizado para nada é sinal de
      // manipulação de URL, não de "sem token" legítimo; 0 webhooks em modo
      // "Sem token" existem hoje (DA4), então isto não quebra ninguém.
      if (!normalizedToken) {
        return unauthenticated();
      }

      const inboundCandidates = await teamWebhookRepository.listInboundByTeamId(input.teamId);
      const matched = findMatchingInboundWebhook(inboundCandidates, normalizedToken);

      if (matched) {
        if (matched.status === "disabled" || matched.status === "paused") {
          return new Output(false, [], [WEBHOOK_INACTIVE_ERROR], {
            authenticated: false,
            webhookId: matched.id,
            supabaseId: null,
            source: "team_webhook",
          });
        }

        if (isStudioWebhookTokenExpired(matched.expiresAt)) {
          return new Output(false, [], [TOKEN_EXPIRED_ERROR], {
            authenticated: false,
            webhookId: matched.id,
            supabaseId: null,
            source: "team_webhook",
          });
        }

        if (!team.master.supabaseId) {
          return new Output(false, [], ["Master do time sem identificação de autenticação"], {
            authenticated: false,
            webhookId: matched.id,
            supabaseId: null,
            source: "team_webhook",
          });
        }

        return new Output(true, [], [], {
          authenticated: true,
          webhookId: matched.id,
          supabaseId: team.master.supabaseId,
          source: "team_webhook",
        });
      }

      // Token não bateu em nenhum TeamWebhook, mas o time já tem inbounds
      // cadastrados: não cai no legado (evita aceitar token de config antiga
      // já substituída — mesma regra de processWebhookLead).
      if (inboundCandidates.length > 0) {
        return unauthenticated();
      }

      const config = await this.service.getWebhookConfigByTeamId(input.teamId);
      if (!config) {
        return unauthenticated();
      }

      // R10-1: o token precisa bater ANTES de qualquer checagem de
      // expiração. Checar a expiração primeiro revelaria (via
      // TOKEN_EXPIRED_ERROR + source: "legacy") que existe uma config para
      // este time mesmo para quem manda um token errado, e o handler trata
      // qualquer `source !== null` como "identidade resolvida" — pulando o
      // rate limit de token inválido e chegando a gravar log com payload.
      const isNoTokenMode = isNoTokenPreview(config.tokenPreview);
      if (isNoTokenMode) {
        if (normalizedToken) {
          return unauthenticated();
        }
      } else {
        if (!normalizedToken) {
          return unauthenticated();
        }
        if (!safeStudioWebhookTokenEquals(normalizedToken, config.tokenHash)) {
          return unauthenticated();
        }
      }

      if (isStudioWebhookTokenExpired(config.expiresAt)) {
        return new Output(false, [], [TOKEN_EXPIRED_ERROR], {
          authenticated: false,
          webhookId: null,
          supabaseId: null,
          source: "legacy",
        });
      }

      if (!team.master.supabaseId) {
        return new Output(false, [], ["Master do time sem identificação de autenticação"], {
          authenticated: false,
          webhookId: null,
          supabaseId: null,
          source: "legacy",
        });
      }

      return new Output(true, [], [], {
        authenticated: true,
        webhookId: null,
        supabaseId: team.master.supabaseId,
        source: "legacy",
      });
    } catch (error) {
      console.error("[StudioWebhookIntegrationUseCase] Erro ao autenticar webhook:", error);
      return new Output(false, [], ["Erro interno ao autenticar webhook"], {
        authenticated: false,
        webhookId: null,
        supabaseId: null,
        source: null,
      });
    }
  }

  async registerWebhookRateLimitRejection(input: {
    teamId: string;
    webhookId: string;
    endpoint: string;
  }): Promise<void> {
    try {
      await teamWebhookEventLogRepository.create({
        teamId: input.teamId,
        webhookId: input.webhookId,
        direction: "inbound",
        result: "rejected",
        method: "POST",
        endpoint: input.endpoint,
        statusCode: 429,
        requestPayload: null,
        responsePayload: null,
        errorMessage: "Limite de requisições excedido",
      });
    } catch (error) {
      console.error(
        "[StudioWebhookIntegrationUseCase] Erro ao registrar rejeição por limite de taxa:",
        error
      );
    }
  }

  async processWebhookLead(input: ProcessStudioWebhookLeadInput): Promise<Output> {
    try {
      const team = await this.service.getTeamWithMaster(input.teamId);
      if (!team) {
        return new Output(false, [], [UNAUTHORIZED_ERROR], null);
      }

      const inboundCandidates = await teamWebhookRepository.listInboundByTeamId(input.teamId);
      const normalizedToken = normalizeOptionalString(input.token);

      const teamInbound = findMatchingInboundWebhook(inboundCandidates, normalizedToken);
      if (teamInbound) {
        if (teamInbound.status === "disabled" || teamInbound.status === "paused") {
          return new Output(false, [], [WEBHOOK_INACTIVE_ERROR], {
            webhookId: teamInbound.id,
          });
        }

        if (isStudioWebhookTokenExpired(teamInbound.expiresAt)) {
          return new Output(false, [], [TOKEN_EXPIRED_ERROR], {
            webhookId: teamInbound.id,
          });
        }

        const isNoTokenMode =
          teamInbound.tokenHash === NONE_TOKEN_HASH ||
          teamInbound.tokenHash === LEGACY_NONE_TOKEN_HASH ||
          isNoTokenPreview(teamInbound.tokenPreview);

        if (isNoTokenMode) {
          if (normalizedToken) {
            return new Output(false, [], [UNAUTHORIZED_ERROR], {
              webhookId: teamInbound.id,
            });
          }
        } else if (!normalizedToken) {
          return new Output(false, [], [UNAUTHORIZED_ERROR], null);
        }

        if (!team.master.supabaseId) {
          return new Output(false, [], ["Master do time sem identificação de autenticação"], {
            webhookId: teamInbound.id,
          });
        }

        const source = normalizeOptionalString(input.payload.source) || "studio_webhook";
        const activityPayload = {
          kind: "lead_creation",
          channel: "webhook",
          provider: "studio",
          source,
          metadata: (input.payload.metadata ?? null) as Prisma.InputJsonValue,
          submittedAt: new Date().toISOString(),
        };

        const leadData: CreateLeadRequest = {
          name: input.payload.name.trim(),
          email: normalizeOptionalString(input.payload.email),
          phone: normalizeOptionalString(input.payload.phone),
          cnpj: normalizeOptionalString(input.payload.cnpj),
          age: normalizeOptionalString(input.payload.ages),
          currentHealthPlan: normalizeOptionalString(input.payload.current_health_plan),
          currentValue: input.payload.current_value,
          referenceHospital: normalizeOptionalString(input.payload.reference_hospital),
          currentTreatment: normalizeOptionalString(input.payload.current_treatment),
          meetingDate: undefined,
          meetingTitle: undefined,
          meetingNotes: undefined,
          meetingLink: undefined,
          notes: undefined,
          assignedTo: undefined,
          closerId: undefined,
          ticket: undefined,
          contractDueDate: undefined,
          soldPlan: undefined,
          confirmDuplicate: true,
          originChannel: "studio_webhook",
          originMetadata: activityPayload,
        };

        const leadOutput = await leadUseCase.createLead(
          team.master.supabaseId,
          leadData,
          input.teamId,
          {
            authorAsStudio: true,
            body: "Lead criado via webhook genérico",
            payload: activityPayload,
          },
          { autoScheduleMeeting: false }
        );

        if (!leadOutput.isValid) {
          return leadOutput;
        }

        const created = leadOutput.result as { id: string; leadCode: string | null };

        await teamWebhookRepository.touchUsage(teamInbound.id, true);
        await this.service.touchWebhookLastUsed(input.teamId).catch(() => undefined);

        return new Output(true, ["Lead criado via webhook com sucesso"], [], {
          id: created.id,
          leadCode: created.leadCode,
          webhookId: teamInbound.id,
        });
      }

      // Token fornecido mas nenhum inbound TeamWebhook bateu: não cair no legado
      // se já existem inbounds (evita aceitar token inválido via config antiga).
      if (inboundCandidates.length > 0) {
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

      if (!team.master.supabaseId) {
        return new Output(false, [], ["Master do time sem identificação de autenticação"], null);
      }

      const source = normalizeOptionalString(input.payload.source) || "studio_webhook";
      const activityPayload = {
        kind: "lead_creation",
        channel: "webhook",
        provider: "studio",
        source,
        metadata: (input.payload.metadata ?? null) as Prisma.InputJsonValue,
        submittedAt: new Date().toISOString(),
      };

      const leadData: CreateLeadRequest = {
        name: input.payload.name.trim(),
        email: normalizeOptionalString(input.payload.email),
        phone: normalizeOptionalString(input.payload.phone),
        cnpj: normalizeOptionalString(input.payload.cnpj),
        age: normalizeOptionalString(input.payload.ages),
        currentHealthPlan: normalizeOptionalString(input.payload.current_health_plan),
        currentValue: input.payload.current_value,
        referenceHospital: normalizeOptionalString(input.payload.reference_hospital),
        currentTreatment: normalizeOptionalString(input.payload.current_treatment),
        meetingDate: undefined,
        meetingTitle: undefined,
        meetingNotes: undefined,
        meetingLink: undefined,
        notes: undefined,
        assignedTo: undefined,
        closerId: undefined,
        ticket: undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
        confirmDuplicate: true,
        originChannel: "studio_webhook",
        originMetadata: activityPayload,
      };

      const leadOutput = await leadUseCase.createLead(
        team.master.supabaseId,
        leadData,
        input.teamId,
        { authorAsStudio: true, body: "Lead criado via webhook genérico", payload: activityPayload },
        { autoScheduleMeeting: false }
      );

      if (!leadOutput.isValid) {
        return leadOutput;
      }

      await this.service.touchWebhookLastUsed(input.teamId);

      const created = leadOutput.result as { id: string; leadCode: string | null };
      return new Output(true, ["Lead criado via webhook com sucesso"], [], {
        id: created.id,
        leadCode: created.leadCode,
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

      // W32: paginação real — antes fixa nos 15 mais recentes.
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.max(1, Math.min(input.pageSize ?? STUDIO_WEBHOOK_LOG_LIMIT, STUDIO_WEBHOOK_LOG_LIMIT));
      const { items, total } = await this.service.listLatestWebhookRequestLogs(input.teamId, {
        page,
        pageSize,
      });

      // SPEC 10, A-E6 (DA6, W7): máscara só na LEITURA — o banco continua
      // com o payload completo (`listLatestWebhookRequestLogs` acima).
      return new Output(true, [], [], {
        logs: items.map((log) => ({
          id: log.id,
          teamId: log.teamId,
          method: log.method,
          endpoint: log.endpoint,
          statusCode: log.statusCode,
          resultType: log.resultType,
          requestPayload: maskSensitiveWebhookPayload(log.requestPayload),
          responsePayload: maskSensitiveWebhookPayload(log.responsePayload),
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
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

      const candidates = await teamWebhookRepository.listInboundByTeamId(input.teamId);
      let inbound =
        (input.webhookId
          ? candidates.find((candidate) => candidate.id === input.webhookId)
          : undefined) ?? null;

      if (!inbound) {
        const normalizedToken = normalizeOptionalString(input.token ?? undefined);
        if (!normalizedToken) {
          inbound =
            candidates.find((candidate) => {
              return (
                candidate.tokenHash === NONE_TOKEN_HASH ||
                candidate.tokenHash === LEGACY_NONE_TOKEN_HASH ||
                isNoTokenPreview(candidate.tokenPreview)
              );
            }) ?? null;
        } else {
          inbound =
            candidates.find((candidate) => {
              if (!candidate.tokenHash) return false;
              const isNoTokenMode =
                candidate.tokenHash === NONE_TOKEN_HASH ||
                candidate.tokenHash === LEGACY_NONE_TOKEN_HASH ||
                isNoTokenPreview(candidate.tokenPreview);
              if (isNoTokenMode) return false;
              return safeStudioWebhookTokenEquals(normalizedToken, candidate.tokenHash);
            }) ?? null;
        }
      }

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
  ROTATION_REQUIRES_CONFIRMATION_ERROR,
};
