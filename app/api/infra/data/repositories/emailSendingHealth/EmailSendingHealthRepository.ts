import type { EmailSendingHealthStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { isPermanentBounce } from "@/lib/email/bounce-suppression"
import type { SendingHealthWindowMetrics } from "@/lib/email/sending-health"
import type {
  DispatchBounceStats,
  IEmailSendingHealthRepository,
  TeamSendingHealthEvaluationRow,
  TeamSendingHealthState,
  UpdateTeamSendingHealthInput,
} from "./IEmailSendingHealthRepository"

const DAY_MS = 24 * 60 * 60 * 1000

type EventWindowCounts = {
  hardBounced7d: number
  hardBounced30d: number
  complained7d: number
  complained30d: number
}

function emptyWindows(): SendingHealthWindowMetrics {
  return {
    sent7d: 0,
    hardBounced7d: 0,
    complained7d: 0,
    sent30d: 0,
    hardBounced30d: 0,
    complained30d: 0,
  }
}

function extractBounceType(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const bounceType = (metadata as Record<string, unknown>).bounceType
  return typeof bounceType === "string" ? bounceType : null
}

export class EmailSendingHealthRepository implements IEmailSendingHealthRepository {
  /**
   * Agrega tudo em memória a partir de 4 consultas indexadas (2 groupBy de
   * envio + bounces 30d + reclamações 30d). Eventos são deduplicados por
   * `logId` — reentrega de webhook não pode inflar a taxa.
   */
  async listTeamsForEvaluation(now: Date): Promise<TeamSendingHealthEvaluationRow[]> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)

    const [sent7dGroups, sent30dGroups, bounceEvents, complaintEvents] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ["teamId"],
        where: { sentAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
      }),
      prisma.emailLog.groupBy({
        by: ["teamId"],
        where: { sentAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
      prisma.emailEvent.findMany({
        where: { type: "bounced", occurredAt: { gte: thirtyDaysAgo } },
        select: {
          logId: true,
          occurredAt: true,
          metadata: true,
          log: { select: { teamId: true } },
        },
      }),
      prisma.emailEvent.findMany({
        where: { type: "complained", occurredAt: { gte: thirtyDaysAgo } },
        select: { logId: true, occurredAt: true, log: { select: { teamId: true } } },
      }),
    ])

    const windowsByTeam = new Map<string, SendingHealthWindowMetrics>()
    const ensureWindows = (teamId: string): SendingHealthWindowMetrics => {
      let windows = windowsByTeam.get(teamId)
      if (!windows) {
        windows = emptyWindows()
        windowsByTeam.set(teamId, windows)
      }
      return windows
    }

    for (const group of sent7dGroups) {
      ensureWindows(group.teamId).sent7d = group._count._all
    }
    for (const group of sent30dGroups) {
      ensureWindows(group.teamId).sent30d = group._count._all
    }

    const countedBounceLogIds = new Set<string>()
    for (const event of bounceEvents) {
      if (countedBounceLogIds.has(event.logId)) continue
      countedBounceLogIds.add(event.logId)
      if (!isPermanentBounce({ type: extractBounceType(event.metadata) })) continue
      const windows = ensureWindows(event.log.teamId)
      windows.hardBounced30d += 1
      if (event.occurredAt >= sevenDaysAgo) windows.hardBounced7d += 1
    }

    const countedComplaintLogIds = new Set<string>()
    for (const event of complaintEvents) {
      if (countedComplaintLogIds.has(event.logId)) continue
      countedComplaintLogIds.add(event.logId)
      const windows = ensureWindows(event.log.teamId)
      windows.complained30d += 1
      if (event.occurredAt >= sevenDaysAgo) windows.complained7d += 1
    }

    const settingsRows = await prisma.emailTeamSettings.findMany({
      where: {
        OR: [
          { teamId: { in: [...windowsByTeam.keys()] } },
          { sendingHealthStatus: { not: "healthy" } },
        ],
      },
      select: {
        teamId: true,
        sendingHealthStatus: true,
        sendingHealthReason: true,
        sendingHealthChangedAt: true,
        sendingHealthMetrics: true,
        team: { select: { master: { select: { id: true } } } },
      },
    })
    const settingsByTeam = new Map(settingsRows.map((row) => [row.teamId, row]))

    // Times com envio recente mas sem linha de settings: avaliados como
    // `healthy` default; a linha nasce no upsert quando houver o que gravar.
    const teamIdsWithoutSettings = [...windowsByTeam.keys()].filter(
      (teamId) => !settingsByTeam.has(teamId)
    )
    const mastersByTeam = new Map<string, string>()
    if (teamIdsWithoutSettings.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIdsWithoutSettings } },
        select: { id: true, master: { select: { id: true } } },
      })
      for (const team of teams) mastersByTeam.set(team.id, team.master.id)
    }

    const rows: TeamSendingHealthEvaluationRow[] = []

    for (const settings of settingsRows) {
      rows.push({
        teamId: settings.teamId,
        masterProfileId: settings.team.master.id,
        status: settings.sendingHealthStatus,
        reason: settings.sendingHealthReason,
        changedAt: settings.sendingHealthChangedAt,
        metricsJson: settings.sendingHealthMetrics,
        windows: windowsByTeam.get(settings.teamId) ?? emptyWindows(),
      })
    }

    for (const teamId of teamIdsWithoutSettings) {
      const masterProfileId = mastersByTeam.get(teamId)
      if (!masterProfileId) continue
      rows.push({
        teamId,
        masterProfileId,
        status: "healthy",
        reason: null,
        changedAt: null,
        metricsJson: null,
        windows: windowsByTeam.get(teamId) ?? emptyWindows(),
      })
    }

    return rows
  }

  async getTeamSendingHealth(teamId: string): Promise<TeamSendingHealthState | null> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: {
        teamId: true,
        sendingHealthStatus: true,
        sendingHealthReason: true,
        sendingHealthChangedAt: true,
        sendingHealthMetrics: true,
        team: { select: { master: { select: { id: true } } } },
      },
    })
    if (!settings) return null
    return {
      teamId: settings.teamId,
      masterProfileId: settings.team.master.id,
      status: settings.sendingHealthStatus,
      reason: settings.sendingHealthReason,
      changedAt: settings.sendingHealthChangedAt,
      metricsJson: settings.sendingHealthMetrics,
    }
  }

  async updateTeamSendingHealth(input: UpdateTeamSendingHealthInput): Promise<void> {
    const snapshotData = input.snapshot
      ? { sendingHealthMetrics: input.snapshot as unknown as Prisma.InputJsonValue }
      : {}
    const transitionData = input.transition
      ? {
          sendingHealthStatus: input.transition.status as EmailSendingHealthStatus,
          sendingHealthReason: input.transition.reason,
          sendingHealthChangedAt: input.transition.changedAt,
        }
      : {}

    await prisma.emailTeamSettings.upsert({
      where: { teamId: input.teamId },
      update: { ...snapshotData, ...transitionData },
      create: {
        teamId: input.teamId,
        ...snapshotData,
        ...transitionData,
      },
    })
  }

  async getDispatchBounceStats(dispatchId: string): Promise<DispatchBounceStats> {
    const [sentCount, bounceEvents] = await Promise.all([
      prisma.emailLog.count({ where: { dispatchId, sentAt: { not: null } } }),
      prisma.emailEvent.findMany({
        where: { type: "bounced", log: { dispatchId } },
        select: { logId: true, metadata: true },
      }),
    ])

    const countedLogIds = new Set<string>()
    let hardBouncedCount = 0
    for (const event of bounceEvents) {
      if (countedLogIds.has(event.logId)) continue
      countedLogIds.add(event.logId)
      if (isPermanentBounce({ type: extractBounceType(event.metadata) })) {
        hardBouncedCount += 1
      }
    }

    return { sentCount, hardBouncedCount }
  }
}

export const emailSendingHealthRepository = new EmailSendingHealthRepository()
