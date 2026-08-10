import type { Prisma } from "@prisma/client"
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"
import type { BackofficeCronExecution } from "@prisma/client"

type CronConfig = {
  cronKey: string
  cronPath: string
}

type CronDependencies = {
  repository?: IBackofficeCronExecutionRepository
  onFailure?: (params: { cronKey: string; cronPath: string; durationMs: number; error: string; executionId: string }) => Promise<void>
}

function getInvalidOutputFailure(result: unknown): Error | null {
  if (
    result &&
    typeof result === "object" &&
    "isValid" in result &&
    (result as { isValid: unknown }).isValid === false
  ) {
    const errorMessages = (result as { errorMessages?: unknown }).errorMessages
    const message = Array.isArray(errorMessages)
      ? errorMessages.filter((entry): entry is string => typeof entry === "string").join("; ")
      : ""
    return new Error(message || "Cron handler returned invalid Output")
  }
  return null
}

async function markCronFailure(
  config: CronConfig,
  repository: IBackofficeCronExecutionRepository,
  execution: BackofficeCronExecution,
  error: Error,
  duration: number,
  dependencies?: CronDependencies,
): Promise<void> {
  try {
    await repository.markFailed(execution.id, error, duration)
  } catch (markError) {
    console.error(
      `[CronAudit] Falha ao marcar falha do cron ${config.cronKey}:`,
      markError
    )
  }

  if (dependencies?.onFailure) {
    try {
      await dependencies.onFailure({
        cronKey: config.cronKey,
        cronPath: config.cronPath,
        durationMs: duration,
        error: error.message,
        executionId: execution.id,
      })
    } catch (notificationError) {
      console.error("[CronAudit] Falha ao executar callback de notificação:", notificationError)
    }
  }
}

/**
 * Wrapper que audita a execução de crons, registrando status, duração e erros.
 * Em caso de falha, executa callback de notificação (best-effort, não bloqueia a execução).
 *
 * @param config - Configuração do cron (chave e caminho)
 * @param handler - Função assíncrona que executa a lógica do cron
 * @param dependencies - Dependências injetáveis (repository e onFailure callback)
 * @returns O resultado da execução do handler
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   // Auth...
 *
 *   const output = await withCronAudit(
 *     { cronKey: 'email-import', cronPath: '/api/v1/email/cron/process-import-jobs' },
 *     () => useCase.execute()
 *   )
 *
 *   return NextResponse.json(output)
 * }
 * ```
 */
export async function withCronAudit<T>(
  config: CronConfig,
  handler: () => Promise<T>,
  dependencies?: CronDependencies
): Promise<T> {
  const repository = dependencies?.repository ?? backofficeCronExecutionRepository

  let execution: BackofficeCronExecution | null = null

  try {
    execution = await repository.create({
      cronKey: config.cronKey,
      cronPath: config.cronPath,
      status: "running",
    })
  } catch (error) {
    console.error(
      `[CronAudit] Falha ao registrar início do cron ${config.cronKey}:`,
      error
    )
  }

  const start = Date.now()

  try {
    const result = await handler()
    const duration = Date.now() - start
    const invalidOutputError = getInvalidOutputFailure(result)

    if (invalidOutputError) {
      if (execution) {
        await markCronFailure(config, repository, execution, invalidOutputError, duration, dependencies)
      }
      return result
    }

    if (execution) {
      let metadata: Prisma.InputJsonValue | undefined
      if (result && typeof result === "object" && "result" in result) {
        metadata = result.result as Prisma.InputJsonValue
      }

      try {
        await repository.markSuccess(execution.id, duration, metadata)
      } catch (markError) {
        console.error(
          `[CronAudit] Falha ao marcar sucesso do cron ${config.cronKey}:`,
          markError
        )
      }
    }

    return result
  } catch (error) {
    const duration = Date.now() - start
    const errorObj = error instanceof Error ? error : new Error(String(error))

    if (execution) {
      await markCronFailure(config, repository, execution, errorObj, duration, dependencies)
    }

    throw error
  }
}
