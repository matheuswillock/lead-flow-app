import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateLandingAnalyticsEventInput,
  ILandingAnalyticsRepository,
  LandingAnalyticsFilterOptions,
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

  async listFilterOptions(teamId: string): Promise<LandingAnalyticsFilterOptions> {
    const [landingPages, campaignIds] = await Promise.all([
      prisma.landingPage.findMany({
        where: { teamId },
        select: {
          id: true,
          publicId: true,
          name: true,
          templateSlug: true,
          publicForm: { select: { id: true, name: true } },
          publications: {
            select: { id: true, version: true, publishedAt: true, endedAt: true },
            orderBy: { publishedAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.landingAnalyticsEvent.findMany({
        where: { teamId, campaignId: { not: null } },
        distinct: ["campaignId"],
        select: { campaignId: true },
      }),
    ])

    const campaigns = campaignIds.flatMap(({ campaignId }) => campaignId ? [campaignId] : [])
    const campaignRecords = campaigns.length === 0
      ? []
      : await prisma.emailCampaign.findMany({
        where: { teamId, id: { in: campaigns } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    const templateLabels = new Map<string, string>()
    for (const landingPage of landingPages) {
      if (!templateLabels.has(landingPage.templateSlug)) templateLabels.set(landingPage.templateSlug, landingPage.templateSlug)
    }

    return {
      campaigns: campaignRecords.map((campaign) => ({ value: campaign.id, label: campaign.name })),
      landingPages: landingPages.map((landingPage) => ({ value: landingPage.id, label: landingPage.name, description: landingPage.publicId })),
      templates: [...templateLabels.entries()].map(([value, label]) => ({ value, label })),
      forms: uniqueOptions(landingPages.map(({ publicForm }) => ({ value: publicForm.id, label: publicForm.name }))),
      publications: landingPages.flatMap((landingPage) => landingPage.publications.map((publication) => ({
        value: publication.id,
        label: `${landingPage.name} — v${publication.version}`,
        description: publication.endedAt ? "Encerrada" : `Publicada em ${publication.publishedAt.toLocaleDateString("pt-BR")}`,
      }))),
    }
  }
}

function uniqueOptions(options: Array<{ value: string; label: string }>) {
  return [...new Map(options.map((option) => [option.value, option])).values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
}

function isUniqueEventIdError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export const landingAnalyticsRepository = new LandingAnalyticsRepository()
