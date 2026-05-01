import { Prisma } from "@prisma/client"
import type { BackofficeWebhookRequestLog } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeWebhookRequestLogInput,
  IBackofficeWebhookRequestLogRepository,
  ListBackofficeWebhookRequestLogsParams,
} from "./IBackofficeWebhookRequestLogRepository"

const DEFAULT_LIMIT = 15
const MAX_LIMIT = 100

function toPrismaJsonValue(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (typeof value === "undefined") return undefined
  if (value === null) return Prisma.JsonNull

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
  } catch {
    return {
      serializationError: "unserializable_payload",
    } as Prisma.InputJsonValue
  }
}

export class BackofficeWebhookRequestLogRepository
  implements IBackofficeWebhookRequestLogRepository
{
  async create(data: CreateBackofficeWebhookRequestLogInput): Promise<void> {
    await prisma.backofficeWebhookRequestLog.create({
      data: {
        source: data.source,
        method: data.method.trim().toUpperCase(),
        endpoint: data.endpoint.trim(),
        statusCode: data.statusCode,
        resultType: data.resultType,
        requestPayload: toPrismaJsonValue(data.requestPayload),
        responsePayload: toPrismaJsonValue(data.responsePayload),
        errorMessage: data.errorMessage ?? null,
      },
    })
  }

  async findMany(
    params?: ListBackofficeWebhookRequestLogsParams
  ): Promise<BackofficeWebhookRequestLog[]> {
    const limit = Math.max(1, Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT))

    return prisma.backofficeWebhookRequestLog.findMany({
      where: { source: params?.source },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  }
}
