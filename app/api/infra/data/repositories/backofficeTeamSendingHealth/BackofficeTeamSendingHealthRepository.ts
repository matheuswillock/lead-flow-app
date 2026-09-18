import type { EmailSendingHealthStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { SendingHealthSnapshot } from "@/lib/email/sending-health"
import type {
  BackofficeTeamSendingHealthMeta,
  BackofficeTeamSendingHealthSettingsRow,
  IBackofficeTeamSendingHealthRepository,
} from "./IBackofficeTeamSendingHealthRepository"

/**
 * Módulo backoffice isolado: consultas próprias sobre `email_team_settings`
 * (trava de reputação é dado do produto ADMINISTRADO pelo backoffice, mesmo
 * modelo de `backofficeTeamEmailLimitGrant`).
 */
export class BackofficeTeamSendingHealthRepository
  implements IBackofficeTeamSendingHealthRepository
{
  async listHealthSettings(
    teamIds?: string[]
  ): Promise<BackofficeTeamSendingHealthSettingsRow[]> {
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
      changedAt: row.sendingHealthChangedAt,
    }))
  }

  async getTeamHealthMeta(teamId: string): Promise<BackofficeTeamSendingHealthMeta | null> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: { sendingHealthStatus: true, sendingHealthMetrics: true },
    })
    if (!settings) return null
    return {
      status: settings.sendingHealthStatus,
      metricsJson: settings.sendingHealthMetrics,
    }
  }

  async upsertTeamHealth(params: {
    teamId: string
    status: string
    reason: string | null
    changedAt: Date
    snapshot?: SendingHealthSnapshot
  }): Promise<void> {
    const snapshotData = params.snapshot
      ? { sendingHealthMetrics: params.snapshot as unknown as Prisma.InputJsonValue }
      : {}
    const healthData = {
      sendingHealthStatus: params.status as EmailSendingHealthStatus,
      sendingHealthReason: params.reason,
      sendingHealthChangedAt: params.changedAt,
    }

    await prisma.emailTeamSettings.upsert({
      where: { teamId: params.teamId },
      update: { ...healthData, ...snapshotData },
      create: { teamId: params.teamId, ...healthData, ...snapshotData },
    })
  }
}

export const backofficeTeamSendingHealthRepository =
  new BackofficeTeamSendingHealthRepository()
