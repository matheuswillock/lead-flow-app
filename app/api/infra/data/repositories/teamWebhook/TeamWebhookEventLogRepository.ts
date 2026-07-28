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

export class TeamWebhookEventLogRepository implements ITeamWebhookEventLogRepository {
  async create(input: CreateTeamWebhookEventLogInput): Promise<void> {
    await prisma.teamWebhookEventLog.create({
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
