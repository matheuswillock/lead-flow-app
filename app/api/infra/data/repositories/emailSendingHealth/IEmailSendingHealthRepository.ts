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
}
