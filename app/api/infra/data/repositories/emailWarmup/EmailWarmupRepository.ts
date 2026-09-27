import { prisma } from "@/app/api/infra/data/prisma"
import { resolveEmailWarmupState, type EmailWarmupState } from "@/lib/email/warmup-policy"
import type { IEmailWarmupRepository, EmailWarmupReservation } from "./IEmailWarmupRepository"

export class EmailWarmupRepository implements IEmailWarmupRepository {
  async getState(teamId: string, now = new Date()): Promise<EmailWarmupState> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: { resendDomainName: true, sendingHealthStatus: true, sendingHealthMetrics: true },
    })
    const warmup = readWarmupMetrics(settings?.sendingHealthMetrics)
    return resolveEmailWarmupState({
      stage: warmup.stage,
      limit: 100,
      used: warmup.used,
      health: settings?.sendingHealthStatus === "paused" || settings?.sendingHealthStatus === "suspended" ? "paused" : settings?.sendingHealthStatus === "warned" ? "attention" : "healthy",
      lastActivityAt: warmup.lastActivityAt,
      isSharedPlatformDomain: !settings?.resendDomainName,
    }, now)
  }

  async reserve(teamId: string, requested: number, now = new Date()): Promise<EmailWarmupReservation> {
    const safeRequested = Math.max(0, Math.trunc(requested))
    return prisma.$transaction(async (tx) => {
      const settings = await tx.emailTeamSettings.findUnique({
        where: { teamId },
        select: { resendDomainName: true, sendingHealthStatus: true, sendingHealthMetrics: true },
      })
      const warmup = readWarmupMetrics(settings?.sendingHealthMetrics)
      const state = resolveEmailWarmupState({
        stage: warmup.stage,
        limit: 100,
        used: warmup.used,
        health: settings?.sendingHealthStatus === "paused" || settings?.sendingHealthStatus === "suspended" ? "paused" : settings?.sendingHealthStatus === "warned" ? "attention" : "healthy",
        lastActivityAt: warmup.lastActivityAt,
        isSharedPlatformDomain: !settings?.resendDomainName,
      }, now)
      const accepted = state.status === "paused" ? 0 : Math.min(safeRequested, state.remaining)
      const deferred = safeRequested - accepted
      if (!state.isSharedPlatformDomain && accepted > 0) {
        const metrics = settings?.sendingHealthMetrics && typeof settings.sendingHealthMetrics === "object" && !Array.isArray(settings.sendingHealthMetrics) ? settings.sendingHealthMetrics as Record<string, unknown> : {}
        await tx.emailTeamSettings.upsert({ where: { teamId }, create: { teamId, sendingHealthMetrics: { ...metrics, warmup: { stage: state.stage, used: accepted, lastActivityAt: now.toISOString() } } }, update: { sendingHealthMetrics: { ...metrics, warmup: { stage: state.stage, used: state.used + accepted, lastActivityAt: now.toISOString() } } } })
      }
      return { ...state, used: state.used + accepted, remaining: Math.max(0, state.remaining - accepted), accepted, deferred }
    })
  }
}

function readWarmupMetrics(value: unknown): { stage: number; used: number; lastActivityAt: Date | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { stage: 0, used: 0, lastActivityAt: null }
  const warmup = (value as Record<string, unknown>).warmup
  if (!warmup || typeof warmup !== "object" || Array.isArray(warmup)) return { stage: 0, used: 0, lastActivityAt: null }
  const data = warmup as Record<string, unknown>
  const lastActivityAt = typeof data.lastActivityAt === "string" ? new Date(data.lastActivityAt) : null
  return { stage: typeof data.stage === "number" ? data.stage : 0, used: typeof data.used === "number" ? data.used : 0, lastActivityAt: lastActivityAt && !Number.isNaN(lastActivityAt.getTime()) ? lastActivityAt : null }
}

export const emailWarmupRepository = new EmailWarmupRepository()
