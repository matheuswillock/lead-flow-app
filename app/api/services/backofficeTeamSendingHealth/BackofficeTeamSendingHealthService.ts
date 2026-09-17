import { prisma } from "@/app/api/infra/data/prisma"
import {
  buildPauseSnapshotFromExisting,
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
 * Módulo backoffice isolado: consultas próprias sobre `email_team_settings`
 * (a trava de reputação é dado do produto ADMINISTRADO pelo backoffice, mesmo
 * modelo de `backofficeTeamEmailLimitGrant`). A máquina de estados é a MESMA
 * de `lib/email/sending-health.ts` — lib compartilhada, nunca cópia.
 */
export class BackofficeTeamSendingHealthService
  implements IBackofficeTeamSendingHealthService
{
  async list(teamIds?: string[]): Promise<BackofficeTeamSendingHealthRow[]> {
    const settings = await prisma.emailTeamSettings.findMany({
      where:
        teamIds && teamIds.length > 0
          ? { teamId: { in: teamIds } }
          : { sendingHealthStatus: { not: "healthy" } },
      select: {
        teamId: true,
        sendingHealthStatus: true,
        sendingHealthReason: true,
        sendingHealthChangedAt: true,
        team: {
          select: {
            name: true,
            master: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { sendingHealthChangedAt: "desc" },
    })

    return settings.map((row) => ({
      teamId: row.teamId,
      teamName: row.team.name,
      masterName: row.team.master.fullName ?? row.team.master.email ?? null,
      status: row.sendingHealthStatus,
      reason: row.sendingHealthReason,
      changedAt: row.sendingHealthChangedAt ? row.sendingHealthChangedAt.toISOString() : null,
    }))
  }

  async applyAction(params: {
    teamId: string
    action: BackofficeSendingHealthAction
  }): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId: params.teamId },
      select: { sendingHealthStatus: true, sendingHealthMetrics: true },
    })
    const currentStatus = (settings?.sendingHealthStatus ??
      "healthy") as EmailSendingHealthStatusValue
    const now = new Date()

    if (params.action === "release") {
      const release = resolveManualSendingHealthRelease({
        current: currentStatus,
        actor: "backoffice",
      })
      if (!release.ok) {
        return { ok: false, message: release.message }
      }
      await prisma.emailTeamSettings.upsert({
        where: { teamId: params.teamId },
        update: {
          sendingHealthStatus: release.next,
          sendingHealthReason: release.reason,
          sendingHealthChangedAt: now,
        },
        create: {
          teamId: params.teamId,
          sendingHealthStatus: release.next,
          sendingHealthReason: release.reason,
          sendingHealthChangedAt: now,
        },
      })
      return { ok: true, status: release.next }
    }

    if (currentStatus === "paused" || currentStatus === "suspended") {
      return { ok: false, message: "O envio deste time já está pausado ou suspenso." }
    }

    const { snapshot, pauseCount } = buildPauseSnapshotFromExisting(
      settings?.sendingHealthMetrics ?? null,
      now
    )
    const suspended = pauseCount >= SENDING_HEALTH_SUSPEND_PAUSE_COUNT
    const nextStatus = suspended ? "suspended" : "paused"
    const reason = suspended
      ? buildSendingHealthSuspendReason(pauseCount)
      : BACKOFFICE_FORCED_PAUSE_REASON

    await prisma.emailTeamSettings.upsert({
      where: { teamId: params.teamId },
      update: {
        sendingHealthStatus: nextStatus,
        sendingHealthReason: reason,
        sendingHealthChangedAt: now,
        sendingHealthMetrics: snapshot as unknown as object,
      },
      create: {
        teamId: params.teamId,
        sendingHealthStatus: nextStatus,
        sendingHealthReason: reason,
        sendingHealthChangedAt: now,
        sendingHealthMetrics: snapshot as unknown as object,
      },
    })
    return { ok: true, status: nextStatus }
  }
}

export const backofficeTeamSendingHealthService = new BackofficeTeamSendingHealthService()
