import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  EMAIL_WARMUP_LIMITS,
  evaluateEmailWarmupProgression,
  resolveEmailWarmupState,
  type EmailDomainHealth,
  type EmailWarmupHistoryDay,
  type EmailWarmupState,
} from "@/lib/email/warmup-policy"
import type { EmailWarmupReservation, IEmailWarmupRepository } from "./IEmailWarmupRepository"

type DomainSettings = {
  resendDomainName: string | null
  sendingHealthStatus: "healthy" | "warned" | "paused" | "suspended"
  sendingHealthMetrics: unknown
}

export class EmailWarmupRepository implements IEmailWarmupRepository {
  async getState(teamId: string, now = new Date()): Promise<EmailWarmupState> {
    const settings = await this.getSettings(teamId)
    if (!settings.resendDomainName) return buildSharedDomainState(now)

    try {
      const domainState = await prisma.emailSendingDomainState.findUnique({
        where: { teamId_domain: { teamId, domain: normalizeDomain(settings.resendDomainName) } },
        select: {
          stage: true,
          dailyLimit: true,
          health: true,
          lastActivityAt: true,
          dailyUsage: {
            where: { usageDate: toUtcDate(now) },
            select: { sent: true, reserved: true },
          },
        },
      })
      if (!domainState) return this.getLegacyState(settings, now)
      const usage = domainState.dailyUsage[0]
      return resolveEmailWarmupState({
        stage: domainState.stage,
        limit: domainState.dailyLimit,
        used: (usage?.sent ?? 0) + (usage?.reserved ?? 0),
        reserved: usage?.reserved ?? 0,
        health: domainState.health,
        lastActivityAt: domainState.lastActivityAt,
      }, now)
    } catch (error) {
      if (!isMissingTableError(error)) throw error
      return this.getLegacyState(settings, now)
    }
  }

  async reserve(teamId: string, requested: number, now = new Date()): Promise<EmailWarmupReservation> {
    const safeRequested = Math.max(0, Math.trunc(requested))
    const settings = await this.getSettings(teamId)
    if (!settings.resendDomainName) {
      return { ...buildSharedDomainState(now), accepted: safeRequested, deferred: 0 }
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const domain = normalizeDomain(settings.resendDomainName as string)
          const health = mapHealth(settings.sendingHealthStatus)
          const state = await tx.emailSendingDomainState.upsert({
            where: { teamId_domain: { teamId, domain } },
            create: {
              teamId,
              domain,
              health,
              status: health === "paused" ? "paused" : "warming",
              nextEvaluationAt: nextUtcDay(now),
            },
            update: { health },
          })
          await tx.$queryRaw`SELECT id FROM "corretor_studio_email_sending_domain_states" WHERE id = ${state.id}::uuid FOR UPDATE`
          const usageDate = toUtcDate(now)
          const usage = await tx.emailSendingDomainDailyUsage.upsert({
            where: { domainStateId_usageDate: { domainStateId: state.id, usageDate } },
            create: { domainStateId: state.id, usageDate, capacity: state.dailyLimit },
            update: {},
          })
          const occupied = usage.sent + usage.reserved
          const available = health === "paused" ? 0 : Math.max(0, usage.capacity - occupied)
          const accepted = Math.min(safeRequested, available)
          if (accepted > 0) {
            await tx.emailSendingDomainDailyUsage.update({
              where: { id: usage.id },
              data: { reserved: { increment: accepted } },
            })
            await tx.emailSendingDomainState.update({
              where: { id: state.id },
              data: { lastActivityAt: now },
            })
          }
          const resolved = resolveEmailWarmupState({
            stage: state.stage,
            limit: usage.capacity,
            used: occupied + accepted,
            reserved: usage.reserved + accepted,
            health,
            lastActivityAt: accepted > 0 ? now : state.lastActivityAt,
          }, now)
          return { ...resolved, accepted, deferred: safeRequested - accepted }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (!isMissingTableError(error)) throw error
      return this.reserveLegacy(teamId, safeRequested, settings, now)
    }
  }

  async release(teamId: string, quantity: number, now = new Date()): Promise<void> {
    await this.adjustUsage(teamId, Math.max(0, Math.trunc(quantity)), "release", now)
  }

  async recordSent(teamId: string, quantity: number, now = new Date()): Promise<void> {
    await this.adjustUsage(teamId, Math.max(0, Math.trunc(quantity)), "sent", now)
  }

  async evaluate(teamId: string, now = new Date()): Promise<EmailWarmupState> {
    const settings = await this.getSettings(teamId)
    if (!settings.resendDomainName) return buildSharedDomainState(now)
    try {
      const domain = normalizeDomain(settings.resendDomainName)
      const state = await prisma.emailSendingDomainState.findUnique({
      where: { teamId_domain: { teamId, domain } },
      select: {
        id: true,
        stage: true,
        lastActivityAt: true,
        lastProgressedAt: true,
        dailyUsage: {
          where: { usageDate: { gte: addDays(toUtcDate(now), -7) } },
          orderBy: { usageDate: "asc" },
          select: {
            capacity: true,
            sent: true,
            delivered: true,
            bounced: true,
            complained: true,
          },
        },
      },
    })
      if (!state) return this.getLegacyState(settings, now)
      const decision = evaluateEmailWarmupProgression({
      stage: state.stage,
      health: mapHealth(settings.sendingHealthStatus),
      lastActivityAt: state.lastActivityAt,
      days: state.dailyUsage.map(mapHistoryDay),
    }, now)
      const limit = EMAIL_WARMUP_LIMITS[decision.stage]
      const status = decision.action === "pause"
      ? "paused"
      : decision.stage === EMAIL_WARMUP_LIMITS.length - 1
        ? "established"
        : "warming"
      await prisma.emailSendingDomainState.update({
      where: { id: state.id },
      data: {
        stage: decision.stage,
        dailyLimit: limit,
        status,
        temperature: status === "established" ? "stable" : "warming",
        health: mapHealth(settings.sendingHealthStatus),
        reason: decision.reason,
        lastProgressedAt: decision.action === "advance" ? now : state.lastProgressedAt,
        pausedAt: decision.action === "pause" ? now : null,
        nextEvaluationAt: nextUtcDay(now),
      },
    })
      return this.getState(teamId, now)
    } catch (error) {
      if (!isMissingTableError(error)) throw error
      return this.getLegacyState(settings, now)
    }
  }

  private async adjustUsage(
    teamId: string,
    quantity: number,
    operation: "release" | "sent",
    now: Date
  ): Promise<void> {
    if (quantity === 0) return
    const settings = await this.getSettings(teamId)
    if (!settings.resendDomainName) return
    const state = await prisma.emailSendingDomainState.findUnique({
      where: { teamId_domain: { teamId, domain: normalizeDomain(settings.resendDomainName) } },
      select: { id: true },
    })
    if (!state) return
    const usage = await prisma.emailSendingDomainDailyUsage.findUnique({
      where: { domainStateId_usageDate: { domainStateId: state.id, usageDate: toUtcDate(now) } },
    })
    if (!usage) return
    const adjusted = Math.min(quantity, usage.reserved)
    await prisma.emailSendingDomainDailyUsage.update({
      where: { id: usage.id },
      data: operation === "sent"
        ? { reserved: { decrement: adjusted }, sent: { increment: adjusted } }
        : { reserved: { decrement: adjusted }, released: { increment: adjusted } },
    })
  }

  private async getSettings(teamId: string): Promise<DomainSettings> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: { resendDomainName: true, sendingHealthStatus: true, sendingHealthMetrics: true },
    })
    return settings ?? {
      resendDomainName: null,
      sendingHealthStatus: "healthy",
      sendingHealthMetrics: null,
    }
  }

  private getLegacyState(settings: DomainSettings, now: Date): EmailWarmupState {
    const warmup = readWarmupMetrics(settings.sendingHealthMetrics)
    return resolveEmailWarmupState({
      stage: warmup.stage,
      limit: EMAIL_WARMUP_LIMITS[warmup.stage] ?? EMAIL_WARMUP_LIMITS[0],
      used: warmup.used,
      health: mapHealth(settings.sendingHealthStatus),
      lastActivityAt: warmup.lastActivityAt,
    }, now)
  }

  private async reserveLegacy(
    teamId: string,
    requested: number,
    settings: DomainSettings,
    now: Date
  ): Promise<EmailWarmupReservation> {
    const state = this.getLegacyState(settings, now)
    const accepted = state.status === "paused" ? 0 : Math.min(requested, state.remaining)
    const metrics = isRecord(settings.sendingHealthMetrics) ? settings.sendingHealthMetrics : {}
    if (accepted > 0) {
      await prisma.emailTeamSettings.update({
        where: { teamId },
        data: {
          sendingHealthMetrics: {
            ...metrics,
            warmup: { stage: state.stage, used: state.used + accepted, lastActivityAt: now.toISOString() },
          },
        },
      })
    }
    return {
      ...state,
      used: state.used + accepted,
      remaining: Math.max(0, state.remaining - accepted),
      accepted,
      deferred: requested - accepted,
    }
  }
}

function buildSharedDomainState(now: Date): EmailWarmupState {
  return resolveEmailWarmupState({
    stage: EMAIL_WARMUP_LIMITS.length - 1,
    limit: Number.MAX_SAFE_INTEGER,
    used: 0,
    health: "healthy",
    lastActivityAt: now,
    isSharedPlatformDomain: true,
  }, now)
}

function mapHistoryDay(day: {
  capacity: number
  sent: number
  delivered: number
  bounced: number
  complained: number
}): EmailWarmupHistoryDay {
  return {
    capacity: day.capacity,
    sent: day.sent,
    delivered: day.delivered,
    hardBounced: day.bounced,
    softBounced: 0,
    complained: day.complained,
  }
}

function mapHealth(status: DomainSettings["sendingHealthStatus"]): EmailDomainHealth {
  if (status === "paused" || status === "suspended") return "paused"
  if (status === "warned") return "attention"
  return "healthy"
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase()
}

function toUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function nextUtcDay(value: Date): Date {
  return addDays(toUtcDate(value), 1)
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readWarmupMetrics(value: unknown): { stage: number; used: number; lastActivityAt: Date | null } {
  if (!isRecord(value) || !isRecord(value.warmup)) return { stage: 0, used: 0, lastActivityAt: null }
  const lastActivityAt = typeof value.warmup.lastActivityAt === "string"
    ? new Date(value.warmup.lastActivityAt)
    : null
  return {
    stage: typeof value.warmup.stage === "number" ? value.warmup.stage : 0,
    used: typeof value.warmup.used === "number" ? value.warmup.used : 0,
    lastActivityAt: lastActivityAt && !Number.isNaN(lastActivityAt.getTime()) ? lastActivityAt : null,
  }
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"
}

export const emailWarmupRepository = new EmailWarmupRepository()
