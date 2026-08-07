import type {
  BackofficeCronExecution,
  BackofficeCronStatus,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeCronExecutionInput,
  IBackofficeCronExecutionRepository,
  ListBackofficeCronExecutionsParams,
} from "./IBackofficeCronExecutionRepository"

const DEFAULT_LIMIT = 50

export class BackofficeCronExecutionRepository
  implements IBackofficeCronExecutionRepository
{
  async create(data: CreateBackofficeCronExecutionInput): Promise<BackofficeCronExecution> {
    return prisma.backofficeCronExecution.create({
      data: {
        cronKey: data.cronKey,
        cronPath: data.cronPath,
        status: data.status ?? "running",
      },
    })
  }

  async findMany(
    params?: ListBackofficeCronExecutionsParams
  ): Promise<BackofficeCronExecution[]> {
    return prisma.backofficeCronExecution.findMany({
      where: {
        cronKey: params?.cronKey,
        status: params?.status,
        startedAt: {
          gte: params?.startDate,
          lte: params?.endDate,
        },
      },
      orderBy: { startedAt: "desc" },
      take: params?.limit ?? DEFAULT_LIMIT,
    })
  }

  async markSuccess(
    id: string,
    durationMs: number,
    metadata?: Parameters<typeof prisma.backofficeCronExecution.update>[0]["data"]["metadata"]
  ): Promise<BackofficeCronExecution> {
    return prisma.backofficeCronExecution.update({
      where: { id },
      data: {
        status: "success" satisfies BackofficeCronStatus,
        finishedAt: new Date(),
        durationMs,
        metadata,
        errorSummary: null,
        errorDetail: null,
      },
    })
  }

  async markFailed(
    id: string,
    error: Error,
    durationMs: number
  ): Promise<BackofficeCronExecution> {
    const errorLines = error.message.split("\n")
    const errorSummary = errorLines[0] ?? error.message
    const errorDetail = error.stack ?? error.message

    return prisma.backofficeCronExecution.update({
      where: { id },
      data: {
        status: "failed" satisfies BackofficeCronStatus,
        finishedAt: new Date(),
        durationMs,
        errorSummary,
        errorDetail,
      },
    })
  }
}

export const backofficeCronExecutionRepository = new BackofficeCronExecutionRepository()
