import type {
  TeamWebhook,
  TeamWebhookDestinationPreset,
  TeamWebhookEventKey,
  TeamWebhookStatus,
} from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { pickNextAssignee } from "@/lib/webhooks/inbound/v2/roundRobin";
import type {
  CreateTeamWebhookData,
  ITeamWebhookRepository,
  ListTeamWebhooksParams,
  TeamWebhookRow,
  TeamWebhookTeamContext,
  UpdateTeamWebhookData,
} from "./ITeamWebhookRepository";
import { TEAM_WEBHOOK_SELECT } from "./ITeamWebhookRepository";

export class TeamWebhookRepository implements ITeamWebhookRepository {
  async listWithCtx(
    ctx: TeamWebhookTeamContext,
    params: ListTeamWebhooksParams
  ): Promise<{ items: TeamWebhookRow[]; total: number }> {
    const where = {
      teamId: ctx.teamId,
      direction: params.direction,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: "insensitive" as const } }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.teamWebhook.count({ where }),
      prisma.teamWebhook.findMany({
        where,
        select: TEAM_WEBHOOK_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return { items, total };
  }

  async findByIdWithCtx(
    ctx: TeamWebhookTeamContext,
    id: string
  ): Promise<TeamWebhookRow | null> {
    return prisma.teamWebhook.findFirst({
      where: { id, teamId: ctx.teamId },
      select: TEAM_WEBHOOK_SELECT,
    });
  }

  async findInboundByTeamId(teamId: string): Promise<TeamWebhookRow | null> {
    return prisma.teamWebhook.findFirst({
      where: { teamId, direction: "inbound" },
      select: TEAM_WEBHOOK_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async listInboundByTeamId(teamId: string): Promise<TeamWebhookRow[]> {
    return prisma.teamWebhook.findMany({
      where: { teamId, direction: "inbound" },
      select: TEAM_WEBHOOK_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async createWithCtx(
    ctx: TeamWebhookTeamContext,
    data: CreateTeamWebhookData
  ): Promise<TeamWebhookRow> {
    return prisma.teamWebhook.create({
      data: {
        teamId: ctx.teamId,
        direction: data.direction,
        status: data.status ?? "active",
        name: data.name,
        // SPEC 11: sem estes campos o banco aplica os defaults (v1, escopo leads_create, sem SDRs).
        ...(data.contractVersion !== undefined && { contractVersion: data.contractVersion }),
        ...(data.scopes !== undefined && { scopes: data.scopes }),
        ...(data.defaultAssigneeProfileIds !== undefined && {
          defaultAssigneeProfileIds: data.defaultAssigneeProfileIds,
        }),
        defaultMeetingLink: data.defaultMeetingLink ?? null,
        targetUrl: data.targetUrl ?? null,
        destinationPreset: data.destinationPreset ?? null,
        selectedEvents: data.selectedEvents ?? [],
        failureThreshold: data.failureThreshold ?? 10,
        tokenHash: data.tokenHash ?? null,
        tokenCipher: data.tokenCipher ?? null,
        tokenPreview: data.tokenPreview ?? null,
        signingSecretCipher: data.signingSecretCipher ?? null,
        signingSecretPreview: data.signingSecretPreview ?? null,
        expiryMode: data.expiryMode ?? null,
        expiresAt: data.expiresAt ?? null,
        updatedByProfileId: ctx.profileId,
      },
      select: TEAM_WEBHOOK_SELECT,
    });
  }

  async updateWithCtx(
    ctx: TeamWebhookTeamContext,
    id: string,
    data: UpdateTeamWebhookData
  ): Promise<TeamWebhookRow> {
    return prisma.teamWebhook.update({
      where: { id },
      data: {
        ...data,
        updatedByProfileId: ctx.profileId,
      },
      select: TEAM_WEBHOOK_SELECT,
    });
  }

  async claimNextRoundRobinAssignee(
    webhookId: string
  ): Promise<{ assigneeProfileId: string | null; listConfigured: boolean }> {
    return prisma.$transaction(async (tx) => {
      // FOR UPDATE: eventos simultâneos do mesmo webhook se enfileiram aqui, então a leitura do
      // ponteiro e a sua escrita nunca se intercalam (dez eventos para três SDRs = 4, 3 e 3).
      const rows = await tx.$queryRaw<
        Array<{ teamId: string; defaultAssigneeProfileIds: string[] | null; lastAssignedProfileId: string | null }>
      >`
        SELECT "teamId", "defaultAssigneeProfileIds", "lastAssignedProfileId"
        FROM corretor_studio_team_webhooks
        WHERE id = ${webhookId}::uuid
        FOR UPDATE
      `;
      const row = rows[0];
      const ordered = row?.defaultAssigneeProfileIds ?? [];
      if (!row || ordered.length === 0) return { assigneeProfileId: null, listConfigured: false };

      const validMembers = await tx.teamMember.findMany({
        where: {
          teamId: row.teamId,
          profileId: { in: ordered },
          functions: { has: "SDR" },
          profile: { deletedAt: null },
        },
        select: { profileId: true },
      });

      const next = pickNextAssignee({
        ordered,
        lastAssignedId: row.lastAssignedProfileId,
        validIds: new Set(validMembers.map((member) => member.profileId)),
      });

      if (next) {
        await tx.teamWebhook.update({ where: { id: webhookId }, data: { lastAssignedProfileId: next } });
      }
      return { assigneeProfileId: next, listConfigured: true };
    });
  }

  async setStatusWithCtx(
    ctx: TeamWebhookTeamContext,
    id: string,
    status: TeamWebhookStatus,
    pauseReason?: string | null
  ): Promise<TeamWebhookRow> {
    const isPaused = status === "paused";
    const isActive = status === "active";

    return prisma.teamWebhook.update({
      where: { id },
      data: {
        status,
        pauseReason: isActive ? null : (pauseReason ?? null),
        pausedAt: isPaused ? new Date() : isActive ? null : undefined,
        failureStreak: isActive ? 0 : undefined,
        updatedByProfileId: ctx.profileId,
      },
      select: TEAM_WEBHOOK_SELECT,
    });
  }

  async countOutboundWithCtx(ctx: TeamWebhookTeamContext): Promise<number> {
    return prisma.teamWebhook.count({
      where: { teamId: ctx.teamId, direction: "outbound" },
    });
  }

  async countInboundWithCtx(ctx: TeamWebhookTeamContext): Promise<number> {
    return prisma.teamWebhook.count({
      where: { teamId: ctx.teamId, direction: "inbound" },
    });
  }

  async findActiveOutboundForEvent(
    teamId: string,
    eventKey: TeamWebhookEventKey
  ): Promise<
    Array<{
      id: string;
      teamId: string;
      targetUrl: string;
      destinationPreset: TeamWebhookDestinationPreset;
      failureStreak: number;
      failureThreshold: number;
      name: string;
    }>
  > {
    const rows = await prisma.teamWebhook.findMany({
      where: {
        teamId,
        direction: "outbound",
        status: "active",
        selectedEvents: { has: eventKey },
        targetUrl: { not: null },
      },
      select: {
        id: true,
        teamId: true,
        targetUrl: true,
        destinationPreset: true,
        failureStreak: true,
        failureThreshold: true,
        name: true,
      },
    });

    return rows
      .filter((row): row is typeof row & { targetUrl: string } => Boolean(row.targetUrl))
      .map((row) => ({
        id: row.id,
        teamId: row.teamId,
        targetUrl: row.targetUrl,
        destinationPreset: row.destinationPreset ?? "generic",
        failureStreak: row.failureStreak,
        failureThreshold: row.failureThreshold,
        name: row.name,
      }));
  }

  async incrementFailureStreak(webhookId: string): Promise<TeamWebhook> {
    return prisma.teamWebhook.update({
      where: { id: webhookId },
      data: {
        failureStreak: { increment: 1 },
        lastFailureAt: new Date(),
      },
    });
  }

  async resetFailureStreak(webhookId: string): Promise<void> {
    await prisma.teamWebhook.update({
      where: { id: webhookId },
      data: {
        failureStreak: 0,
        lastSuccessAt: new Date(),
        lastUsedAt: new Date(),
      },
    });
  }

  async markPausedByFailures(webhookId: string): Promise<TeamWebhook> {
    return prisma.teamWebhook.update({
      where: { id: webhookId },
      data: {
        status: "paused",
        pauseReason: "auto_failure",
        pausedAt: new Date(),
      },
    });
  }

  async touchUsage(webhookId: string, success: boolean): Promise<void> {
    await prisma.teamWebhook.update({
      where: { id: webhookId },
      data: {
        lastUsedAt: new Date(),
        ...(success
          ? { lastSuccessAt: new Date() }
          : { lastFailureAt: new Date() }),
      },
    });
  }

  async findForDelivery(webhookId: string) {
    return prisma.teamWebhook.findUnique({
      where: { id: webhookId },
      select: {
        id: true,
        teamId: true,
        status: true,
        name: true,
        targetUrl: true,
        destinationPreset: true,
        failureStreak: true,
        failureThreshold: true,
        signingSecretCipher: true,
        updatedByProfileId: true,
      },
    });
  }

  async findTeamMasterId(teamId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { masterId: true },
    });
    return team?.masterId ?? null;
  }

  async createAutoPausedNotification(input: {
    recipientProfileId: string;
    teamId: string;
    webhookId: string;
    webhookName: string;
  }): Promise<void> {
    await prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: "WEBHOOK_AUTO_PAUSED",
        message: `O webhook de saída "${input.webhookName}" foi pausado automaticamente após falhas consecutivas de envio.`,
        metadata: {
          webhookId: input.webhookId,
          name: input.webhookName,
        },
      },
    });
  }
}

export const teamWebhookRepository = new TeamWebhookRepository();
