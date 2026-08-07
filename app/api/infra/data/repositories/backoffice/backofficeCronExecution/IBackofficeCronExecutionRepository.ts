import type {
  BackofficeCronExecution,
  BackofficeCronStatus,
  Prisma,
} from "@prisma/client"

export interface CreateBackofficeCronExecutionInput {
  cronKey: string
  cronPath: string
  status?: BackofficeCronStatus
}

export interface ListBackofficeCronExecutionsParams {
  cronKey?: string
  status?: BackofficeCronStatus
  startDate?: Date
  endDate?: Date
  limit?: number
}

export interface IBackofficeCronExecutionRepository {
  create(data: CreateBackofficeCronExecutionInput): Promise<BackofficeCronExecution>
  findMany(params?: ListBackofficeCronExecutionsParams): Promise<BackofficeCronExecution[]>
  markSuccess(id: string, durationMs: number, metadata?: Prisma.InputJsonValue): Promise<BackofficeCronExecution>
  markFailed(id: string, error: Error, durationMs: number): Promise<BackofficeCronExecution>
}
