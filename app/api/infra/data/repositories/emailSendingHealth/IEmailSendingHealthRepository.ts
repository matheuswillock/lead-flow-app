import type { EmailSendingHealthStatus, Prisma } from "@prisma/client"
import type {
  SendingHealthSnapshot,
  SendingHealthWindowMetrics,
} from "@/lib/email/sending-health"

export type TeamSendingHealthEvaluationRow = {
  teamId: string
  masterProfileId: string
  status: EmailSendingHealthStatus
  reason: string | null
  changedAt: Date | null
  metricsJson: Prisma.JsonValue | null
  windows: SendingHealthWindowMetrics
}

export type TeamSendingHealthState = {
  teamId: string
  masterProfileId: string
  status: EmailSendingHealthStatus
  reason: string | null
  changedAt: Date | null
  metricsJson: Prisma.JsonValue | null
}

export type UpdateTeamSendingHealthInput = {
  teamId: string
  /** Ausente = transição sem tocar no snapshot (ex.: liberação manual, que preserva o histórico de pausas). */
  snapshot?: SendingHealthSnapshot
  /** Ausente = refresh de snapshot sem transição de status. */
  transition?: {
    status: EmailSendingHealthStatus
    reason: string | null
    changedAt: Date
  }
}

export type DispatchBounceStats = {
  sentCount: number
  hardBouncedCount: number
}

export interface IEmailSendingHealthRepository {
  /**
   * Times a avaliar num tick do cron: quem enviou nos últimos 30 dias +
   * quem está fora de `healthy` (para recuperação/pruning do histórico).
   * Janelas 7d/30d já agregadas com semântica de hard bounce
   * (`bounceType === "Permanent"` — `lib/email/bounce-suppression.ts`).
   */
  listTeamsForEvaluation(now: Date): Promise<TeamSendingHealthEvaluationRow[]>

  getTeamSendingHealth(teamId: string): Promise<TeamSendingHealthState | null>

  updateTeamSendingHealth(input: UpdateTeamSendingHealthInput): Promise<void>

  /** Enviados × hard bounces de UMA parte (dispatch) — gatilho do abort mid-send. */
  getDispatchBounceStats(dispatchId: string): Promise<DispatchBounceStats>

  /**
   * Contagem 7d medida DIRETAMENTE desde `since` — usada quando o time tem um
   * `releaseBaseline` ativo (liberação manual há menos de
   * `SENDING_HEALTH_RELEASE_BASELINE_DAYS` dias). Substitui a antiga subtração
   * (janela atual − janela na liberação), que zerava incidentes novos quando o
   * volume total ficava estável (churn: envios antigos saem da janela na mesma
   * proporção em que envios novos ruins entram) — achado P1 do codex no
   * PR #1204. `since` é sempre `releaseBaseline.at`, que por definição de
   * baseline ativo já está dentro dos últimos 7 dias.
   */
  getWindowMetricsSince(
    teamId: string,
    since: Date,
    now: Date
  ): Promise<Pick<SendingHealthWindowMetrics, "sent7d" | "hardBounced7d" | "complained7d">>
}
