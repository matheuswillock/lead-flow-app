import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  CreateStudioWebhookRequestLogInput,
  IStudioWebhookConfigRepository,
  ListLatestWebhookRequestLogsParams,
  ListLatestWebhookRequestLogsResult,
  StudioWebhookConfigSnapshot,
  StudioWebhookTeamSnapshot,
  UpsertStudioWebhookConfigInput,
} from "./IStudioWebhookConfigRepository";

const toPrismaJsonValue = (
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return {
      serializationError: "unserializable_payload",
    } as Prisma.InputJsonValue;
  }
};

const WEBHOOK_REQUEST_LOG_SELECT = {
  id: true,
  teamId: true,
  method: true,
  endpoint: true,
  statusCode: true,
  resultType: true,
  requestPayload: true,
  responsePayload: true,
  errorMessage: true,
  createdAt: true,
} as const;

const WEBHOOK_CONFIG_SELECT = {
  id: true,
  teamId: true,
  tokenHash: true,
  tokenCipher: true,
  tokenPreview: true,
  expiryMode: true,
  expiresAt: true,
  lastUsedAt: true,
  updatedByProfileId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class StudioWebhookConfigRepository implements IStudioWebhookConfigRepository {
  async getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        masterId: true,
        master: {
          select: {
            id: true,
            supabaseId: true,
          },
        },
      },
    });
  }

  async getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null> {
    return prisma.teamStudioWebhookConfig.findUnique({
      where: { teamId },
      select: WEBHOOK_CONFIG_SELECT,
    });
  }

  async upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot> {
    return prisma.teamStudioWebhookConfig.upsert({
      where: { teamId: input.teamId },
      create: {
        teamId: input.teamId,
        tokenHash: input.tokenHash,
        tokenCipher: input.tokenCipher,
        tokenPreview: input.tokenPreview,
        expiryMode: input.expiryMode,
        expiresAt: input.expiresAt,
        updatedByProfileId: input.updatedByProfileId,
      },
      update: {
        tokenHash: input.tokenHash,
        tokenCipher: input.tokenCipher,
        tokenPreview: input.tokenPreview,
        expiryMode: input.expiryMode,
        expiresAt: input.expiresAt,
        updatedByProfileId: input.updatedByProfileId,
      },
      select: WEBHOOK_CONFIG_SELECT,
    });
  }

  async touchWebhookLastUsed(teamId: string): Promise<void> {
    await prisma.teamStudioWebhookConfig.updateMany({
      where: { teamId },
      data: { lastUsedAt: new Date() },
    });
  }

  async createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void> {
    const normalizedEndpoint = input.endpoint.trim();

    await prisma.$transaction(async (tx) => {
      await tx.teamStudioWebhookRequestLog.create({
        data: {
          teamId: input.teamId,
          method: input.method.trim().toUpperCase(),
          endpoint: normalizedEndpoint,
          statusCode: input.statusCode,
          resultType: input.resultType,
          requestPayload: toPrismaJsonValue(input.requestPayload),
          responsePayload: toPrismaJsonValue(input.responsePayload),
          errorMessage: input.errorMessage ?? null,
        },
      });

      const logsToDelete = await tx.teamStudioWebhookRequestLog.findMany({
        where: {
          teamId: input.teamId,
          endpoint: normalizedEndpoint,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 15,
        select: { id: true },
      });

      if (logsToDelete.length > 0) {
        await tx.teamStudioWebhookRequestLog.deleteMany({
          where: {
            id: {
              in: logsToDelete.map((log) => log.id),
            },
          },
        });
      }
    });
  }

  async listLatestWebhookRequestLogs(
    teamId: string,
    params: ListLatestWebhookRequestLogsParams
  ): Promise<ListLatestWebhookRequestLogsResult> {
    // W32: retenção continua em 15 por (teamId, endpoint) — o teto de
    // pageSize acompanha isso, mas `total` reflete o que existir de fato.
    const safePageSize = Math.max(1, Math.min(params.pageSize, 15));
    const safePage = Math.max(1, params.page);

    const [total, items] = await Promise.all([
      prisma.teamStudioWebhookRequestLog.count({ where: { teamId } }),
      prisma.teamStudioWebhookRequestLog.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: WEBHOOK_REQUEST_LOG_SELECT,
      }),
    ]);

    return { items, total };
  }
}

export const studioWebhookConfigRepository = new StudioWebhookConfigRepository();
