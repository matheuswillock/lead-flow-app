import type {
  BackofficeCronExecution,
  BackofficeCronStatus,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  ClaimStaleRunningAsFailedParams,
  CreateBackofficeCronExecutionInput,
  FindStaleRunningCandidatesParams,
  IBackofficeCronExecutionRepository,
  ListBackofficeCronExecutionsParams,
} from "./IBackofficeCronExecutionRepository"

const DEFAULT_LIMIT = 50
const DEFAULT_STALE_CANDIDATES_LIMIT = 500

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

  async findStaleRunningCandidates(
    params: FindStaleRunningCandidatesParams
  ): Promise<BackofficeCronExecution[]> {
    return prisma.backofficeCronExecution.findMany({
      where: {
        status: "running" satisfies BackofficeCronStatus,
        startedAt: { lt: params.startedBefore },
      },
      orderBy: { startedAt: "asc" },
      take: params.limit ?? DEFAULT_STALE_CANDIDATES_LIMIT,
    })
  }

  async claimStaleRunningAsFailed(
    params: ClaimStaleRunningAsFailedParams
  ): Promise<boolean> {
    const claimed = await prisma.backofficeCronExecution.updateMany({
      where: {
        id: params.id,
        status: "running" satisfies BackofficeCronStatus,
      },
      data: {
        status: "failed" satisfies BackofficeCronStatus,
        finishedAt: params.finishedAt,
        durationMs: params.durationMs,
        errorSummary: params.errorSummary,
        errorDetail: params.errorDetail,
      },
    })

    return claimed.count === 1
  }
}

export const backofficeCronExecutionRepository = new BackofficeCronExecutionRepository()
