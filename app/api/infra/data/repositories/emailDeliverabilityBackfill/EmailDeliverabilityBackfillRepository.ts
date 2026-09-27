import { prisma } from "@/app/api/infra/data/prisma"
import { EMAIL_WARMUP_LIMITS } from "@/lib/email/warmup-policy"

export interface IEmailDeliverabilityBackfillRepository {
  backfill(): Promise<{ scanned: number; warmup: number; dmarc: number }>
}

export class EmailDeliverabilityBackfillRepository implements IEmailDeliverabilityBackfillRepository {
  async backfill() {
    const settingsRows = await prisma.emailTeamSettings.findMany({
      where: { resendDomainName: { not: null } },
      select: { teamId: true, resendDomainName: true, sendingHealthStatus: true, sendingHealthMetrics: true },
    })
    let warmup = 0
    let dmarc = 0
    for (const settings of settingsRows) {
      if (!settings.resendDomainName) continue
      const metrics = asRecord(settings.sendingHealthMetrics)
      const legacyWarmup = asRecord(metrics.warmup)
      const stage = clampStage(numberOr(legacyWarmup.stage, 0))
      const lastActivityAt = dateOrNull(legacyWarmup.lastActivityAt)
      await prisma.emailSendingDomainState.upsert({
        where: { teamId_domain: { teamId: settings.teamId, domain: settings.resendDomainName.toLowerCase() } },
        create: {
          teamId: settings.teamId,
          domain: settings.resendDomainName.toLowerCase(),
          stage,
          dailyLimit: EMAIL_WARMUP_LIMITS[stage],
          health: mapHealth(settings.sendingHealthStatus),
          status: mapHealth(settings.sendingHealthStatus) === "paused" ? "paused" : "warming",
          lastActivityAt,
        },
        update: {},
      })
      warmup += 1

      const legacyDmarc = asRecord(metrics.dmarc)
      const status = normalizeDmarcStatus(legacyDmarc.status)
      if (status) {
        await prisma.emailDmarcDomainState.upsert({
          where: { teamId_domain: { teamId: settings.teamId, domain: settings.resendDomainName.toLowerCase() } },
          create: { teamId: settings.teamId, domain: settings.resendDomainName.toLowerCase(), status },
          update: {},
        })
        dmarc += 1
      }
    }
    return { scanned: settingsRows.length, warmup, dmarc }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function dateOrNull(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function clampStage(stage: number): number {
  return Math.min(Math.max(Math.trunc(stage), 0), EMAIL_WARMUP_LIMITS.length - 1)
}

function mapHealth(status: "healthy" | "warned" | "paused" | "suspended") {
  if (status === "paused" || status === "suspended") return "paused" as const
  if (status === "warned") return "attention" as const
  return "healthy" as const
}

function normalizeDmarcStatus(value: unknown) {
  return value === "pending" || value === "aligned" || value === "attention" || value === "failed" ? value : null
}

export const emailDeliverabilityBackfillRepository = new EmailDeliverabilityBackfillRepository()
