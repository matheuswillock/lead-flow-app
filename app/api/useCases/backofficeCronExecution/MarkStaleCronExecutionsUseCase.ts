import type { BackofficeCronExecution } from "@prisma/client"
import { Output } from "@/lib/output"
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import {
  resolveMinimumStaleThresholdMs,
  resolveStaleThresholdMs,
} from "@/app/api/lib/cron/cronStaleThresholds"

/** `errorSummary` gravado nas execuções que o watchdog encerra. */
export const STALE_CRON_EXECUTION_ERROR_SUMMARY = "stale_running_timeout"

/** Teto do Postgres `Int` (32 bits) — coluna `durationMs` não comporta valor maior. */
export const MAX_DURATION_MS = 2_147_483_647

/** Orçamento máximo para aguardar o alerta best-effort antes de seguir para a próxima candidata. */
export const ALERT_TIMEOUT_MS = 5_000

export type StaleCronExecutionNotifier = (params: {
  cronKey: string
  cronPath: string
  durationMs: number
  error: string
  executionId: string
}) => Promise<void>

type MarkStaleCronExecutionsResult = {
  scanned: number
  markedFailed: number
  skippedWithinThreshold: number
  alreadyClaimed: number
  byCronKey: Record<string, number>
}

/**
 * Encerra execuções de cron presas em `running`.
 *
 * O kill de plataforma (timeout 300s, OOM, deploy) não passa pelo `catch` do
 * `withCronAudit` — a linha nunca sai de `running` e o alerta de falha nunca
 * dispara. Este caso de uso varre as candidatas, aplica o teto **do próprio
 * `cronKey`** (crons legitimamente longos não podem ser marcados por engano) e
 * reivindica cada uma com um update atômico antes de alertar.
 */
export class MarkStaleCronExecutionsUseCase {
  constructor(
    private readonly repository: IBackofficeCronExecutionRepository = backofficeCronExecutionRepository,
    private readonly notifyStale: StaleCronExecutionNotifier = getDefaultCronSlackCallback(),
    private readonly now: () => Date = () => new Date(),
    private readonly alertTimeoutMs: number = ALERT_TIMEOUT_MS,
  ) {}

  private isStale(execution: BackofficeCronExecution, referenceTime: Date): boolean {
    const elapsedMs = referenceTime.getTime() - execution.startedAt.getTime()
    return elapsedMs >= resolveStaleThresholdMs(execution.cronKey)
  }

  private clampDurationMs(elapsedMs: number): number {
    return Math.min(elapsedMs, MAX_DURATION_MS)
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Alerta best-effort excedeu o orçamento de ${timeoutMs}ms`))
      }, timeoutMs)

      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  private buildErrorDetail(execution: BackofficeCronExecution, elapsedMs: number): string {
    return [
      `Execução presa em running e encerrada pelo watchdog de crons.`,
      `cronKey=${execution.cronKey}`,
      `cronPath=${execution.cronPath}`,
      `startedAt=${execution.startedAt.toISOString()}`,
      `elapsedMs=${elapsedMs}`,
      `thresholdMs=${resolveStaleThresholdMs(execution.cronKey)}`,
    ].join(" | ")
  }

  private async alertBestEffort(
    execution: BackofficeCronExecution,
    elapsedMs: number,
  ): Promise<void> {
    try {
      await this.withTimeout(
        this.notifyStale({
          cronKey: execution.cronKey,
          cronPath: execution.cronPath,
          durationMs: elapsedMs,
          error: STALE_CRON_EXECUTION_ERROR_SUMMARY,
          executionId: execution.id,
        }),
        this.alertTimeoutMs,
      )
    } catch (notificationError) {
      console.error(
        "[MarkStaleCronExecutionsUseCase][execute] Falha ao alertar execução órfã:",
        notificationError,
      )
    }
  }

  async execute(): Promise<Output> {
    try {
      const referenceTime = this.now()
      const candidates = await this.repository.findStaleRunningCandidates({
        startedBefore: new Date(referenceTime.getTime() - resolveMinimumStaleThresholdMs()),
      })

      const result: MarkStaleCronExecutionsResult = {
        scanned: candidates.length,
        markedFailed: 0,
        skippedWithinThreshold: 0,
        alreadyClaimed: 0,
        byCronKey: {},
      }

      for (const execution of candidates) {
        if (!this.isStale(execution, referenceTime)) {
          result.skippedWithinThreshold += 1
          continue
        }

        const elapsedMs = referenceTime.getTime() - execution.startedAt.getTime()
        const claimed = await this.repository.claimStaleRunningAsFailed({
          id: execution.id,
          errorSummary: STALE_CRON_EXECUTION_ERROR_SUMMARY,
          errorDetail: this.buildErrorDetail(execution, elapsedMs),
          durationMs: this.clampDurationMs(elapsedMs),
          finishedAt: referenceTime,
        })

        if (!claimed) {
          result.alreadyClaimed += 1
          continue
        }

        result.markedFailed += 1
        result.byCronKey[execution.cronKey] = (result.byCronKey[execution.cronKey] ?? 0) + 1
        await this.alertBestEffort(execution, elapsedMs)
      }

      console.info("[MarkStaleCronExecutionsUseCase][execute] varredura concluída", result)

      return new Output(
        true,
        [`${result.markedFailed} execuções órfãs encerradas`],
        [],
        result,
      )
    } catch (error) {
      console.error("[MarkStaleCronExecutionsUseCase][execute]", error)
      return new Output(false, [], ["Erro ao encerrar execuções de cron órfãs"], null)
    }
  }
}

export const markStaleCronExecutionsUseCase = new MarkStaleCronExecutionsUseCase()
