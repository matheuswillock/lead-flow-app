import { prisma } from "@/app/api/infra/data/prisma";
import type {
  BackofficeBotAiAttemptStatus,
  BackofficeBotAiProvider,
  Prisma,
} from "@prisma/client";
import type {
  CreateAttemptInput,
  CreateInteractionInput,
  IBackofficeBotAiRepository,
} from "./IBackofficeBotAiRepository";

export class BackofficeBotAiRepository implements IBackofficeBotAiRepository {
  async getConfiguration() {
    const existing = await prisma.backofficeBotAiConfiguration.findUnique({ where: { id: true } });
    if (existing) return existing;
    return prisma.backofficeBotAiConfiguration.create({ data: { id: true } });
  }

  async updateConfiguration(
    data: Prisma.BackofficeBotAiConfigurationUncheckedUpdateInput,
    updatedByProfileId: string
  ) {
    return prisma.backofficeBotAiConfiguration.upsert({
      where: { id: true },
      create: { id: true, updatedByProfileId },
      update: { ...data, updatedByProfileId },
    });
  }

  async createInteraction(input: CreateInteractionInput) {
    return prisma.backofficeBotAiInteraction.create({
      data: {
        inboundMessageId: input.inboundMessageId ?? undefined,
        userLinkId: input.userLinkId ?? undefined,
        profileId: input.profileId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        teamIdSnapshot: input.teamIdSnapshot ?? undefined,
        capability: input.capability,
        status: input.status,
        intent: input.intent ?? undefined,
        confidence: input.confidence ?? undefined,
        promptKey: input.promptKey ?? undefined,
        promptVersion: input.promptVersion ?? "v0",
        isShadow: input.isShadow ?? true,
        usedFallback: input.usedFallback ?? false,
        inputHash: input.inputHash ?? undefined,
        outputHash: input.outputHash ?? undefined,
        errorCode: input.errorCode ?? undefined,
        latencyMs: input.latencyMs ?? undefined,
      },
    });
  }

  async createAttempt(input: CreateAttemptInput) {
    return prisma.backofficeBotAiAttempt.create({
      data: {
        interactionId: input.interactionId,
        sequence: input.sequence,
        provider: input.provider,
        model: input.model,
        capability: input.capability,
        status: input.status,
        inputTokens: input.inputTokens ?? undefined,
        outputTokens: input.outputTokens ?? undefined,
        totalTokens: input.totalTokens ?? undefined,
        estimatedCostUsd: input.estimatedCostUsd ?? undefined,
        latencyMs: input.latencyMs ?? undefined,
        httpStatus: input.httpStatus ?? undefined,
        errorCode: input.errorCode ?? undefined,
        providerRequestId: input.providerRequestId ?? undefined,
        requestSchemaVersion: input.requestSchemaVersion ?? undefined,
        responseSchemaVersion: input.responseSchemaVersion ?? undefined,
      },
    });
  }

  async countAttemptsToday() {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return prisma.backofficeBotAiAttempt.count({
      where: { createdAt: { gte: start } },
    });
  }

  async countAttemptsTodayForUser(userLinkId: string) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return prisma.backofficeBotAiAttempt.count({
      where: {
        createdAt: { gte: start },
        interaction: { userLinkId },
      },
    });
  }

  async countInteractions(from: Date, to: Date) {
    return prisma.backofficeBotAiInteraction.count({
      where: { createdAt: { gte: from, lte: to } },
    });
  }

  async countAttemptsByStatus(from: Date, to: Date) {
    const rows = await prisma.backofficeBotAiAttempt.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, _count: row._count._all }));
  }

  async listAttempts(input: {
    from: Date;
    to: Date;
    page: number;
    pageSize: number;
    provider?: BackofficeBotAiProvider;
    model?: string;
    status?: BackofficeBotAiAttemptStatus;
  }) {
    const where = {
      createdAt: { gte: input.from, lte: input.to },
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.backofficeBotAiAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      prisma.backofficeBotAiAttempt.count({ where }),
    ]);
    return { items, total };
  }

  async listUsersUsage(input: { from: Date; to: Date; page: number; pageSize: number }) {
    const grouped = await prisma.backofficeBotAiInteraction.groupBy({
      by: ["profileId", "userLinkId"],
      where: {
        createdAt: { gte: input.from, lte: input.to },
        OR: [{ profileId: { not: null } }, { userLinkId: { not: null } }],
      },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { profileId: "desc" } },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    const totalGroups = await prisma.backofficeBotAiInteraction.groupBy({
      by: ["profileId", "userLinkId"],
      where: {
        createdAt: { gte: input.from, lte: input.to },
        OR: [{ profileId: { not: null } }, { userLinkId: { not: null } }],
      },
    });
    return {
      items: grouped.map((row) => ({
        profileId: row.profileId,
        userLinkId: row.userLinkId,
        calls: row._count._all,
        lastAt: row._max.createdAt ?? input.from,
      })),
      total: totalGroups.length,
    };
  }

  async findInteractionById(id: string) {
    return prisma.backofficeBotAiInteraction.findUnique({
      where: { id },
      select: {
        id: true,
        inboundMessageId: true,
        userLinkId: true,
        profileId: true,
        sessionId: true,
        teamIdSnapshot: true,
        capability: true,
        status: true,
        intent: true,
        confidence: true,
        promptKey: true,
        promptVersion: true,
        isShadow: true,
        usedFallback: true,
        inputHash: true,
        outputHash: true,
        errorCode: true,
        latencyMs: true,
        createdAt: true,
        attempts: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            interactionId: true,
            sequence: true,
            provider: true,
            model: true,
            capability: true,
            status: true,
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCostUsd: true,
            latencyMs: true,
            httpStatus: true,
            errorCode: true,
            providerRequestId: true,
            requestSchemaVersion: true,
            responseSchemaVersion: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async upsertDailyUsage(input: {
    day: Date;
    provider: BackofficeBotAiProvider;
    model: string;
    capability: CreateAttemptInput["capability"];
    requests: number;
    successes: number;
    failures: number;
    fallbacks: number;
    inputTokens: bigint;
    outputTokens: bigint;
    estimatedCostUsd: number;
    uniqueUsers: number;
    latencyP50Ms?: number | null;
    latencyP95Ms?: number | null;
  }) {
    return prisma.backofficeBotAiDailyUsage.upsert({
      where: {
        day_provider_model_capability: {
          day: input.day,
          provider: input.provider,
          model: input.model,
          capability: input.capability,
        },
      },
      create: {
        day: input.day,
        provider: input.provider,
        model: input.model,
        capability: input.capability,
        requests: input.requests,
        successes: input.successes,
        failures: input.failures,
        fallbacks: input.fallbacks,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        uniqueUsers: input.uniqueUsers,
        latencyP50Ms: input.latencyP50Ms ?? undefined,
        latencyP95Ms: input.latencyP95Ms ?? undefined,
      },
      update: {
        requests: input.requests,
        successes: input.successes,
        failures: input.failures,
        fallbacks: input.fallbacks,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        uniqueUsers: input.uniqueUsers,
        latencyP50Ms: input.latencyP50Ms ?? undefined,
        latencyP95Ms: input.latencyP95Ms ?? undefined,
      },
    });
  }

  async listDailyUsage(from: Date, to: Date) {
    return prisma.backofficeBotAiDailyUsage.findMany({
      where: { day: { gte: from, lte: to } },
      orderBy: { day: "asc" },
    });
  }

  async deleteOldInteractions(before: Date) {
    const result = await prisma.backofficeBotAiInteraction.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return result.count;
  }
}

export const backofficeBotAiRepository = new BackofficeBotAiRepository();
