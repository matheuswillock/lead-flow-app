import type { Prisma } from "@prisma/client"
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"

type CronConfig = {
  cronKey: string
  cronPath: string
}

type CronDependencies = {
  repository?: IBackofficeCronExecutionRepository
  onFailure?: (params: { cronKey: string; cronPath: string; durationMs: number; error: string; executionId: string }) => Promise<void>
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
  
  const execution = await repository.create({
    cronKey: config.cronKey,
    cronPath: config.cronPath,
    status: "running",
  })

  const start = Date.now()

  try {
    const result = await handler()
    const duration = Date.now() - start

    let metadata: Prisma.InputJsonValue | undefined
    if (result && typeof result === "object" && "result" in result) {
      metadata = result.result as Prisma.InputJsonValue
    }

    await repository.markSuccess(
      execution.id,
      duration,
      metadata
    )

    return result
  } catch (error) {
    const duration = Date.now() - start
    const errorObj = error instanceof Error ? error : new Error(String(error))

    await repository.markFailed(
      execution.id,
      errorObj,
      duration
    )

    if (dependencies?.onFailure) {
      try {
        await dependencies.onFailure({
          cronKey: config.cronKey,
          cronPath: config.cronPath,
          durationMs: duration,
          error: errorObj.message,
          executionId: execution.id,
        })
      } catch (notificationError) {
        console.error("[CronAudit] Falha ao executar callback de notificação:", notificationError)
      }
    }

    throw error
  }
}
