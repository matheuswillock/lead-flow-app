import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository"
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"

const BATCH_SIZE = 200
const ACTIVE_WINDOW_DAYS = 30

/** Margem sob o `maxDuration = 300` da rota, para sobrar tempo de persistir o cursor. */
const DEFAULT_TIME_BUDGET_MS = 240_000

export const RADAR_BACKFILL_CRON_KEY = "engagement-backfill"

/**
 * Ordem de trabalho do backfill. Cada fase tem cursor próprio.
 *
 * `pending_active` primeiro porque é a dívida que o produto sente: perfil sem
 * score visto nos últimos 30 dias não entra em segmento por banda, não entra em
 * fila de promoção e não aparece em insight.
 */
const BACKFILL_PHASES = ["pending_active", "pending", "refresh"] as const
export type RadarBackfillPhase = (typeof BACKFILL_PHASES)[number]

export type RadarBackfillProgress = {
  phase: RadarBackfillPhase
  cursorId: string | null
}

function isBackfillPhase(value: unknown): value is RadarBackfillPhase {
  return (BACKFILL_PHASES as readonly string[]).includes(value as string)
}

function nextPhase(phase: RadarBackfillPhase): RadarBackfillPhase | null {
  return BACKFILL_PHASES[BACKFILL_PHASES.indexOf(phase) + 1] ?? null
}

function resolveTimeBudgetMs(): number {
  const raw = Number(process.env.RADAR_BACKFILL_TIME_BUDGET_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIME_BUDGET_MS
}

/**
 * Lê o progresso gravado pela última execução bem-sucedida.
 *
 * O cursor mora no `metadata` de `backoffice_cron_executions` — `withCronAudit`
 * já persiste o `result` do Output ali, então retomar não custa tabela nova nem
 * migration.
 */
function parseProgress(metadata: unknown): RadarBackfillProgress | null {
  if (!metadata || typeof metadata !== "object") return null

  const { phase, cursorId } = metadata as { phase?: unknown; cursorId?: unknown }
  if (!isBackfillPhase(phase)) return null

  return {
    phase,
    cursorId: typeof cursorId === "string" && cursorId ? cursorId : null,
  }
}

/**
 * D19-C: recalcula engagementScore/engagementBand de todos os perfis, em lotes.
 *
 * A versão anterior varria a base do zero em toda invocação e era morta pelo
 * teto de 300s da plataforma — 15 execuções em 30 dias, 15 presas em `running`,
 * nenhuma `success` (auditoria CDP §4 R3). Sem orçamento de tempo interno o
 * cursor recomeçava e a cauda nunca era alcançada.
 *
 * Agora a execução respeita um deadline interno, para num limite limpo e devolve
 * o cursor no Output — que vira o ponto de partida da próxima.
 */
export class RadarEngagementBackfillUseCase {
  constructor(
    private readonly repo = radarRepository,
    private readonly cronExecutions: IBackofficeCronExecutionRepository = backofficeCronExecutionRepository,
    private readonly now: () => number = Date.now
  ) {}

  private async loadResumePoint(): Promise<RadarBackfillProgress | null> {
    try {
      const [lastSuccess] = await this.cronExecutions.findMany({
        cronKey: RADAR_BACKFILL_CRON_KEY,
        status: "success",
        limit: 1,
      })
      return lastSuccess ? parseProgress(lastSuccess.metadata) : null
    } catch (error) {
      // Não saber de onde retomar é degradação aceitável: recomeça a varredura.
      // Falhar a execução inteira por causa da leitura do cursor seria pior.
      console.error("[RadarEngagementBackfillUseCase][loadResumePoint]", error)
      return null
    }
  }

  async execute(): Promise<Output> {
    try {
      const start = this.now()
      const timeBudgetMs = resolveTimeBudgetMs()
      const resumedFrom = await this.loadResumePoint()

      let phase: RadarBackfillPhase = resumedFrom?.phase ?? BACKFILL_PHASES[0]
      let cursorId: string | null = resumedFrom?.cursorId ?? null
      let processed = 0
      let batches = 0
      let timedOut = false
      let cycleCompleted = false

      for (;;) {
        if (this.now() - start >= timeBudgetMs) {
          timedOut = true
          break
        }

        const batch = await this.repo.listProfilesForEngagementBackfill({
          take: BATCH_SIZE,
          cursorId,
          onlyMissingScore: phase !== "refresh",
          activeSince: phase === "pending_active" ? this.activeSince() : null,
        })

        if (batch.length === 0) {
          const following = nextPhase(phase)
          if (!following) {
            // Varreu tudo: o próximo ciclo recomeça do topo.
            cycleCompleted = true
            phase = BACKFILL_PHASES[0]
            cursorId = null
            break
          }
          phase = following
          cursorId = null
          continue
        }

        // Sequencial de propósito: uma conexão por vez. O incidente de pool do
        // RADAR_AUDIT §9 nasceu de paralelizar perfis aqui.
        processed += await this.repo.updateEngagementScoresBatch(batch)
        batches += 1
        cursorId = batch[batch.length - 1]?.id ?? null
      }

      const remaining = await this.repo.countProfilesMissingEngagementScore()
      const durationMs = this.now() - start

      const result = {
        processed,
        batches,
        batchSize: BATCH_SIZE,
        phase,
        cursorId,
        resumedFrom,
        remaining,
        timedOut,
        cycleCompleted,
        durationMs,
        timeBudgetMs,
      }

      console.info("[RadarEngagementBackfillUseCase][execute]", result)

      const message = timedOut
        ? `Backfill parcial: ${processed} perfis, retoma de ${phase}`
        : "Backfill de engajamento concluído"

      return new Output(true, [message], [], result)
    } catch (error) {
      console.error("[RadarEngagementBackfillUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro no backfill de engajamento do Radar"
      return new Output(false, [], [message], null)
    }
  }

  private activeSince(): Date {
    return new Date(this.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  }
}

export const radarEngagementBackfillUseCase = new RadarEngagementBackfillUseCase()
