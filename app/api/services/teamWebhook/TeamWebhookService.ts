import type {
  StudioWebhookTokenExpiryMode,
  TeamWebhookDirection,
  TeamWebhookEventKey,
  TeamWebhookStatus,
} from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { teamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository";
import { teamWebhookOutboxRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository";
import type { TeamWebhookRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository";
import {
  buildTeamWebhookTokenPreview,
  computeTeamWebhookTokenExpiry,
  encryptTeamWebhookToken,
  generateTeamWebhookToken,
  hashTeamWebhookToken,
} from "@/lib/webhooks/teamWebhookSecurity";
import { assertSafeWebhookTargetUrl } from "@/lib/webhooks/ssrfUrlGuard";
import { wrapOutboundPayloadForPreset } from "@/lib/webhooks/webhookPayloadPresets";
import { webhookHttpDeliveryService } from "./WebhookHttpDeliveryService";
import type {
  CreateInboundWebhookInput,
  CreateOutboundWebhookInput,
  ITeamWebhookService,
  TeamWebhookStatusAction,
  TeamWebhookSummaryDto,
  UpdateTeamWebhookInput,
} from "./ITeamWebhookService";

const MAX_OUTBOUND_PER_TEAM = 20;
const NONE_TOKEN_HASH = hashTeamWebhookToken("__none__");

const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

export class TeamWebhookService implements ITeamWebhookService {
  private ctx(access: TeamAccess) {
    return { profileId: access.profileId, teamId: access.teamId };
  }

  private buildInboundUrl(appUrl: string, teamId: string, token: string | null): string {
    const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    if (!token) {
      return `${base}/api/webhooks/studio/${teamId}`;
    }
    return `${base}/api/webhooks/studio/${teamId}/${token}`;
  }

  toSummary(row: TeamWebhookRow, appUrl: string, token?: string): TeamWebhookSummaryDto {
    let webhookUrl: string | null = null;
    if (row.direction === "inbound") {
      if (row.tokenHash === NONE_TOKEN_HASH || !row.tokenHash) {
        webhookUrl = this.buildInboundUrl(appUrl, row.teamId, null);
      } else if (token) {
        webhookUrl = this.buildInboundUrl(appUrl, row.teamId, token);
      } else {
        webhookUrl = this.buildInboundUrl(appUrl, row.teamId, "[token]");
      }
    }

    return {
      id: row.id,
      direction: row.direction,
      status: row.status,
      name: row.name,
      targetUrl: row.targetUrl,
      destinationPreset: row.destinationPreset,
      selectedEvents: row.selectedEvents,
      failureStreak: row.failureStreak,
      failureThreshold: row.failureThreshold,
      lastUsedAt: toIso(row.lastUsedAt),
      lastSuccessAt: toIso(row.lastSuccessAt),
      lastFailureAt: toIso(row.lastFailureAt),
      pausedAt: toIso(row.pausedAt),
      pauseReason: row.pauseReason,
      tokenPreview: row.tokenPreview,
      expiryMode: row.expiryMode,
      expiresAt: toIso(row.expiresAt),
      webhookUrl,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(
    access: TeamAccess,
    params: {
      direction: TeamWebhookDirection;
      status?: TeamWebhookStatus;
      page: number;
      pageSize: number;
    },
    appUrl: string
  ) {
    const { items, total } = await teamWebhookRepository.listWithCtx(this.ctx(access), params);
    return {
      items: items.map((row) => this.toSummary(row, appUrl)),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async getById(access: TeamAccess, id: string, appUrl: string) {
    const row = await teamWebhookRepository.findByIdWithCtx(this.ctx(access), id);
    return row ? this.toSummary(row, appUrl) : null;
  }

  private resolveTokenFields(input: {
    tokenMode: "manual" | "auto" | "none";
    manualToken?: string;
    expiryMode: StudioWebhookTokenExpiryMode;
  }) {
    if (input.tokenMode === "none") {
      return {
        token: null as string | null,
        tokenHash: NONE_TOKEN_HASH,
        tokenCipher: null as string | null,
        tokenPreview: "sem-token",
        expiryMode: input.expiryMode,
        expiresAt: computeTeamWebhookTokenExpiry(input.expiryMode),
      };
    }

    const token =
      input.tokenMode === "manual"
        ? (input.manualToken?.trim() ?? "")
        : generateTeamWebhookToken();

    return {
      token,
      tokenHash: hashTeamWebhookToken(token),
      tokenCipher: encryptTeamWebhookToken(token),
      tokenPreview: buildTeamWebhookTokenPreview(token),
      expiryMode: input.expiryMode,
      expiresAt: computeTeamWebhookTokenExpiry(input.expiryMode),
    };
  }

  async create(
    access: TeamAccess,
    input: CreateInboundWebhookInput | CreateOutboundWebhookInput,
    appUrl: string
  ) {
    if (input.direction === "outbound") {
      const count = await teamWebhookRepository.countOutboundWithCtx(this.ctx(access));
      if (count >= MAX_OUTBOUND_PER_TEAM) {
        throw new Error(`Limite de ${MAX_OUTBOUND_PER_TEAM} webhooks de saída por time`);
      }

      if (!input.selectedEvents?.length) {
        throw new Error("Selecione ao menos um evento");
      }

      const guard = assertSafeWebhookTargetUrl(input.targetUrl);
      if (!guard.ok) {
        throw new Error(guard.reason);
      }

      const row = await teamWebhookRepository.createWithCtx(this.ctx(access), {
        direction: "outbound",
        name: input.name.trim(),
        targetUrl: guard.url.toString(),
        destinationPreset: input.destinationPreset,
        selectedEvents: input.selectedEvents,
        failureThreshold: input.failureThreshold ?? 10,
      });

      return this.toSummary(row, appUrl);
    }

    const tokenFields = this.resolveTokenFields(input);
    const row = await teamWebhookRepository.createWithCtx(this.ctx(access), {
      direction: "inbound",
      name: input.name.trim(),
      tokenHash: tokenFields.tokenHash,
      tokenCipher: tokenFields.tokenCipher,
      tokenPreview: tokenFields.tokenPreview,
      expiryMode: tokenFields.expiryMode,
      expiresAt: tokenFields.expiresAt,
    });

    return {
      ...this.toSummary(row, appUrl, tokenFields.token ?? undefined),
      token: tokenFields.token ?? undefined,
    };
  }

  async update(
    access: TeamAccess,
    id: string,
    input: UpdateTeamWebhookInput,
    appUrl: string
  ) {
    const existing = await teamWebhookRepository.findByIdWithCtx(this.ctx(access), id);
    if (!existing) {
      throw new Error("Webhook não encontrado");
    }

    if (existing.direction === "outbound") {
      if (input.selectedEvents && input.selectedEvents.length === 0) {
        throw new Error("Selecione ao menos um evento");
      }

      let targetUrl = input.targetUrl;
      if (targetUrl) {
        const guard = assertSafeWebhookTargetUrl(targetUrl);
        if (!guard.ok) {
          throw new Error(guard.reason);
        }
        targetUrl = guard.url.toString();
      }

      const row = await teamWebhookRepository.updateWithCtx(this.ctx(access), id, {
        name: input.name?.trim(),
        targetUrl,
        destinationPreset: input.destinationPreset,
        selectedEvents: input.selectedEvents,
        failureThreshold: input.failureThreshold,
      });

      return this.toSummary(row, appUrl);
    }

    let tokenFields:
      | ReturnType<TeamWebhookService["resolveTokenFields"]>
      | undefined;

    if (input.tokenMode) {
      tokenFields = this.resolveTokenFields({
        tokenMode: input.tokenMode,
        manualToken: input.manualToken,
        expiryMode: input.expiryMode ?? existing.expiryMode ?? "indeterminate",
      });
    }

    const row = await teamWebhookRepository.updateWithCtx(this.ctx(access), id, {
      name: input.name?.trim(),
      ...(tokenFields
        ? {
            tokenHash: tokenFields.tokenHash,
            tokenCipher: tokenFields.tokenCipher,
            tokenPreview: tokenFields.tokenPreview,
            expiryMode: tokenFields.expiryMode,
            expiresAt: tokenFields.expiresAt,
          }
        : input.expiryMode
          ? {
              expiryMode: input.expiryMode,
              expiresAt: computeTeamWebhookTokenExpiry(input.expiryMode),
            }
          : {}),
    });

    return {
      ...this.toSummary(row, appUrl, tokenFields?.token ?? undefined),
      token: tokenFields?.token ?? undefined,
    };
  }

  async changeStatus(
    access: TeamAccess,
    id: string,
    action: TeamWebhookStatusAction,
    appUrl: string
  ) {
    const existing = await teamWebhookRepository.findByIdWithCtx(this.ctx(access), id);
    if (!existing) {
      throw new Error("Webhook não encontrado");
    }

    if ("action" in action && action.action === "reactivate") {
      const row = await teamWebhookRepository.setStatusWithCtx(
        this.ctx(access),
        id,
        "active",
        null
      );
      return this.toSummary(row, appUrl);
    }

    if ("status" in action) {
      if (action.status === "disabled") {
        await teamWebhookOutboxRepository.cancelPendingForWebhook(id);
      }
      const row = await teamWebhookRepository.setStatusWithCtx(
        this.ctx(access),
        id,
        action.status,
        action.status === "disabled" ? "manual" : null
      );
      return this.toSummary(row, appUrl);
    }

    throw new Error("Ação de status inválida");
  }

  async listLogs(
    access: TeamAccess,
    id: string,
    params: { page: number; pageSize: number; result?: "success" | "failure" | "rejected" }
  ) {
    const existing = await teamWebhookRepository.findByIdWithCtx(this.ctx(access), id);
    if (!existing) {
      throw new Error("Webhook não encontrado");
    }

    const { items, total } = await teamWebhookEventLogRepository.list({
      webhookId: id,
      teamId: access.teamId,
      result: params.result,
      page: params.page,
      pageSize: params.pageSize,
    });

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async testDelivery(access: TeamAccess, id: string) {
    const existing = await teamWebhookRepository.findByIdWithCtx(this.ctx(access), id);
    if (!existing) {
      throw new Error("Webhook não encontrado");
    }
    if (existing.direction !== "outbound") {
      throw new Error("Teste disponível apenas para webhooks de saída");
    }
    if (existing.status === "disabled") {
      throw new Error("Webhook desativado");
    }
    if (!existing.targetUrl) {
      throw new Error("URL de destino não configurada");
    }

    const envelope = {
      id: `evt_test_${Date.now()}`,
      type: "webhook_test" as const,
      created_at: new Date().toISOString(),
      team_id: access.teamId,
      data: {
        message: "Envio de teste do Corretor Studio",
        webhook_id: existing.id,
        webhook_name: existing.name,
      },
    };

    const body = wrapOutboundPayloadForPreset(
      existing.destinationPreset ?? "generic",
      // cast: test type is not in TeamWebhookEventKey enum
      envelope as unknown as Parameters<typeof wrapOutboundPayloadForPreset>[1]
    );

    const result = await webhookHttpDeliveryService.deliver({
      targetUrl: existing.targetUrl,
      preset: existing.destinationPreset ?? "generic",
      body,
    });

    await teamWebhookEventLogRepository.create({
      teamId: access.teamId,
      webhookId: existing.id,
      direction: "outbound",
      result: result.ok ? "success" : "failure",
      eventKey: null,
      method: "POST",
      endpoint: existing.targetUrl,
      statusCode: result.statusCode,
      requestPayload: body,
      responsePayload: result.responseBody,
      errorMessage: result.errorMessage,
    });

    await teamWebhookRepository.touchUsage(existing.id, result.ok);

    return {
      ok: result.ok,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    };
  }
}

export const teamWebhookService = new TeamWebhookService();

export type { TeamWebhookEventKey };
