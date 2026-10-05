import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateLandingAnalyticsEventInput,
  ILandingAnalyticsRepository,
  LandingAnalyticsSummaryInput,
} from "./ILandingAnalyticsRepository"

export class LandingAnalyticsRepository implements ILandingAnalyticsRepository {
  async createIfAbsent(input: CreateLandingAnalyticsEventInput) {
    try {
      return await prisma.landingAnalyticsEvent.create({
        data: {
          ...input,
          attribution: input.attribution as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      if (isUniqueEventIdError(error)) return null
      throw error
    }
  }

  async summarize(input: LandingAnalyticsSummaryInput) {
    const where = {
      teamId: input.teamId,
      occurredAt: { gte: input.from, lte: input.to },
      ...(input.landingPageId ? { landingPageId: input.landingPageId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.templateSlug ? { templateSlug: input.templateSlug } : {}),
      ...(input.formId ? { formId: input.formId } : {}),
      ...(input.publicationId ? { publicationId: input.publicationId } : {}),
    }
    const [events, grouped] = await Promise.all([
      prisma.landingAnalyticsEvent.findMany({ where, select: { eventType: true, visitorSessionId: true } }),
      prisma.landingAnalyticsEvent.groupBy({ by: ["eventType"], where, _count: { _all: true } }),
    ])
    const sessions = new Map<string, number>()
    for (const event of events) sessions.set(event.visitorSessionId, (sessions.get(event.visitorSessionId) ?? 0) + 1)
    const totals = Object.fromEntries(grouped.map((item) => [item.eventType, item._count._all]))
    return {
      totals,
      uniqueVisitors: sessions.size,
      returningVisitors: [...sessions.values()].filter((count) => count > 1).length,
      byEventType: grouped.map((item) => ({ eventType: item.eventType, count: item._count._all })),
    }
  }
}

function isUniqueEventIdError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export const landingAnalyticsRepository = new LandingAnalyticsRepository()
