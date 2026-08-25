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

export interface FindStaleRunningCandidatesParams {
  startedBefore: Date
  limit?: number
}

export interface ClaimStaleRunningAsFailedParams {
  id: string
  errorSummary: string
  errorDetail: string
  durationMs: number
  finishedAt: Date
}

export interface IBackofficeCronExecutionRepository {
  create(data: CreateBackofficeCronExecutionInput): Promise<BackofficeCronExecution>
  findMany(params?: ListBackofficeCronExecutionsParams): Promise<BackofficeCronExecution[]>
  markSuccess(id: string, durationMs: number, metadata?: Prisma.InputJsonValue): Promise<BackofficeCronExecution>
  markFailed(id: string, error: Error, durationMs: number): Promise<BackofficeCronExecution>
  /** Execuções ainda `running` iniciadas antes do piso — candidatas a órfãs. */
  findStaleRunningCandidates(
    params: FindStaleRunningCandidatesParams,
  ): Promise<BackofficeCronExecution[]>
  /**
   * Claim atômico: só marca `failed` se a linha continuar `running`.
   * Retorna `true` quando esta chamada foi a que reivindicou a execução.
   */
  claimStaleRunningAsFailed(params: ClaimStaleRunningAsFailedParams): Promise<boolean>
}
