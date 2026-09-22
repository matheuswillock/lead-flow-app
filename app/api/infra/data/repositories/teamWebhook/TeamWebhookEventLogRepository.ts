import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  CreateTeamWebhookEventLogInput,
  ITeamWebhookEventLogRepository,
  ListTeamWebhookEventLogsParams,
  TeamWebhookEventLogRow,
} from "./ITeamWebhookEventLogRepository";

const toPrismaJsonValue = (
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return Prisma.JsonNull;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { serializationError: "unserializable_payload" } as Prisma.InputJsonValue;
  }
};

const LOG_SELECT = {
  id: true,
  teamId: true,
  webhookId: true,
  direction: true,
  result: true,
  eventKey: true,
  method: true,
  endpoint: true,
  statusCode: true,
  requestPayload: true,
  responsePayload: true,
  errorMessage: true,
  createdAt: true,
} as const;

/** SPEC 10, DA6 (W7/W11): mesmo teto do legado (`StudioWebhookIntegrationService.ts:37`). */
const TEAM_WEBHOOK_EVENT_LOG_RETENTION_LIMIT = 15;

export class TeamWebhookEventLogRepository implements ITeamWebhookEventLogRepository {
  async create(input: CreateTeamWebhookEventLogInput): Promise<void> {
    // DA6 (W11): sem poda, `TeamWebhookEventLog` cresce sem limite — a
    // gravação e a poda por (teamId, webhookId) rodam na mesma transação,
    // no mesmo padrão de `StudioWebhookIntegrationService.ts:114-147`.
    await prisma.$transaction(async (tx) => {
      await tx.teamWebhookEventLog.create({
        data: {
          teamId: input.teamId,
          webhookId: input.webhookId,
          direction: input.direction,
          result: input.result,
          eventKey: input.eventKey ?? null,
          method: input.method ?? null,
          endpoint: input.endpoint ?? null,
          statusCode: input.statusCode ?? null,
          requestPayload: toPrismaJsonValue(input.requestPayload),
          responsePayload: toPrismaJsonValue(input.responsePayload),
          errorMessage: input.errorMessage ?? null,
        },
      });

      const logsToDelete = await tx.teamWebhookEventLog.findMany({
        where: {
          teamId: input.teamId,
          webhookId: input.webhookId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: TEAM_WEBHOOK_EVENT_LOG_RETENTION_LIMIT,
        select: { id: true },
      });

      if (logsToDelete.length > 0) {
        await tx.teamWebhookEventLog.deleteMany({
          where: { id: { in: logsToDelete.map((log) => log.id) } },
        });
      }
    });
  }

  async list(params: ListTeamWebhookEventLogsParams): Promise<{
    items: TeamWebhookEventLogRow[];
    total: number;
  }> {
    const where = {
      webhookId: params.webhookId,
      teamId: params.teamId,
      ...(params.result ? { result: params.result } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.teamWebhookEventLog.count({ where }),
      prisma.teamWebhookEventLog.findMany({
        where,
        select: LOG_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return { items, total };
  }
}

export const teamWebhookEventLogRepository = new TeamWebhookEventLogRepository();
