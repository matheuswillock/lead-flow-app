import {
  backofficeTeamSendingHealthRepository,
} from "@/app/api/infra/data/repositories/backofficeTeamSendingHealth/BackofficeTeamSendingHealthRepository"
import type {
  IBackofficeTeamSendingHealthRepository,
} from "@/app/api/infra/data/repositories/backofficeTeamSendingHealth/IBackofficeTeamSendingHealthRepository"
import {
  buildPauseSnapshotFromExisting,
  buildReleaseSnapshotFromExisting,
  buildSendingHealthSuspendReason,
  resolveManualSendingHealthRelease,
  SENDING_HEALTH_SUSPEND_PAUSE_COUNT,
  type EmailSendingHealthStatusValue,
} from "@/lib/email/sending-health"
import type {
  BackofficeSendingHealthAction,
  BackofficeTeamSendingHealthRow,
  IBackofficeTeamSendingHealthService,
} from "./IBackofficeTeamSendingHealthService"

const BACKOFFICE_FORCED_PAUSE_REASON =
  "Envio pausado manualmente pelo Corretor Studio (backoffice)."

/**
 * Módulo backoffice isolado (dados via repositório backoffice próprio). A
 * máquina de estados é a MESMA de `lib/email/sending-health.ts` — lib
 * compartilhada, nunca cópia.
 */
export class BackofficeTeamSendingHealthService
  implements IBackofficeTeamSendingHealthService
{
  constructor(
    private readonly repository: IBackofficeTeamSendingHealthRepository = backofficeTeamSendingHealthRepository
  ) {}

  async list(teamIds?: string[]): Promise<BackofficeTeamSendingHealthRow[]> {
    const rows = await this.repository.listHealthSettings(teamIds)
    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      masterName: row.masterName,
      status: row.status,
      reason: row.reason,
      changedAt: row.changedAt ? row.changedAt.toISOString() : null,
    }))
  }

  async applyAction(params: {
    teamId: string
    action: BackofficeSendingHealthAction
  }): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
    const meta = await this.repository.getTeamHealthMeta(params.teamId)
    const currentStatus = (meta?.status ?? "healthy") as EmailSendingHealthStatusValue
    const now = new Date()

    if (params.action === "release") {
      const release = resolveManualSendingHealthRelease({
        current: currentStatus,
        actor: "backoffice",
      })
      if (!release.ok) {
        return { ok: false, message: release.message }
      }
      await this.repository.upsertTeamHealth({
        teamId: params.teamId,
        status: release.next,
        reason: release.reason,
        changedAt: now,
        // Mesma marca de água da liberação do produto: sem ela o cron
        // recontaria o incidente já liberado e re-suspenderia o time.
        snapshot: buildReleaseSnapshotFromExisting(meta?.metricsJson ?? null, now),
      })
      return { ok: true, status: release.next }
    }

    if (currentStatus === "paused" || currentStatus === "suspended") {
      return { ok: false, message: "O envio deste time já está pausado ou suspenso." }
    }

    const { snapshot, pauseCount } = buildPauseSnapshotFromExisting(
      meta?.metricsJson ?? null,
      now
    )
    const suspended = pauseCount >= SENDING_HEALTH_SUSPEND_PAUSE_COUNT
    const nextStatus = suspended ? "suspended" : "paused"
    const reason = suspended
      ? buildSendingHealthSuspendReason(pauseCount)
      : BACKOFFICE_FORCED_PAUSE_REASON

    await this.repository.upsertTeamHealth({
      teamId: params.teamId,
      status: nextStatus,
      reason,
      changedAt: now,
      snapshot,
    })
    return { ok: true, status: nextStatus }
  }
}

export const backofficeTeamSendingHealthService = new BackofficeTeamSendingHealthService()
