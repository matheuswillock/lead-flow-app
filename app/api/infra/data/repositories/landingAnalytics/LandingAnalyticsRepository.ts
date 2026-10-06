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

  async findByEventId(eventId: string) {
    return prisma.landingAnalyticsEvent.findUnique({ where: { eventId } })
  }

  async summarize(input: LandingAnalyticsSummaryInput) {
    const where = {
      teamId: input.teamId,
      occurredAt: { gte: input.from, lt: input.to },
      ...(input.landingPageId ? { landingPageId: input.landingPageId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.templateSlug ? { templateSlug: input.templateSlug } : {}),
      ...(input.formId ? { formId: input.formId } : {}),
      ...(input.publicationId ? { publicationId: input.publicationId } : {}),
    }
    const [sessionGroups, eventGroups, pageViewGroups] = await Promise.all([
      prisma.landingAnalyticsEvent.groupBy({ by: ["visitorSessionId"], where, _count: { _all: true } }),
      prisma.landingAnalyticsEvent.groupBy({ by: ["eventType"], where, _count: { _all: true } }),
      prisma.landingAnalyticsEvent.groupBy({ by: ["visitorSessionId"], where: { ...where, eventType: "landing.page_view" }, _count: { _all: true } }),
    ])
    const totals = Object.fromEntries(eventGroups.map((item) => [item.eventType, item._count._all]))
    return {
      totals,
      uniqueVisitors: pageViewGroups.length,
      returningVisitors: pageViewGroups.filter((group) => group._count._all > 1).length,
      byEventType: eventGroups.map((item) => ({ eventType: item.eventType, count: item._count._all })),
    }
  }
}

function isUniqueEventIdError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export const landingAnalyticsRepository = new LandingAnalyticsRepository()
