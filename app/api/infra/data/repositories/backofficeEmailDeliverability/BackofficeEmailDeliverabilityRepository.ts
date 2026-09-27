import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { DeliverabilityEventV1 } from "@/lib/email/deliverability-event"

export type BackofficeDeliverabilityFilters = {
  from: Date
  teamId?: string
  senderDomain?: string
  recipientProvider?: string
}

export interface IBackofficeEmailDeliverabilityRepository {
  list(filters: BackofficeDeliverabilityFilters): Promise<Array<{
    teamId: string
    teamName: string | null
    metricDate: Date
    senderDomain: string
    recipientProvider: string
    sent: number
    delivered: number
    hardBounced: number
    softBounced: number
    complained: number
  }>>
  project(event: DeliverabilityEventV1): Promise<boolean>
}

export type BackofficeDeliverabilityEventV1 = DeliverabilityEventV1

export class BackofficeEmailDeliverabilityRepository implements IBackofficeEmailDeliverabilityRepository {
  async list(filters: BackofficeDeliverabilityFilters) {
    try {
      return await prisma.backofficeEmailDeliverabilityDailyMetric.findMany({
        where: {
          metricDate: { gte: filters.from },
          ...(filters.teamId ? { teamId: filters.teamId } : {}),
          ...(filters.senderDomain ? { senderDomain: filters.senderDomain } : {}),
          ...(filters.recipientProvider ? { recipientProvider: filters.recipientProvider } : {}),
        },
        orderBy: { metricDate: "asc" },
        select: {
          teamId: true,
          teamName: true,
          metricDate: true,
          senderDomain: true,
          recipientProvider: true,
          sent: true,
          delivered: true,
          hardBounced: true,
          softBounced: true,
          complained: true,
        },
      })
    } catch (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
  }

  async project(event: DeliverabilityEventV1): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.backofficeEmailDeliverabilityProcessedEvent.createMany({
        data: [{ eventKey: event.eventKey }],
        skipDuplicates: true,
      })
      if (claimed.count === 0) return false
      const metricDate = new Date(Date.UTC(
        event.occurredAt.getUTCFullYear(),
        event.occurredAt.getUTCMonth(),
        event.occurredAt.getUTCDate()
      ))
      const increment = eventIncrement(event.type)
      await tx.backofficeEmailDeliverabilityDailyMetric.upsert({
        where: {
          teamId_metricDate_senderDomain_recipientProvider: {
            teamId: event.teamId,
            metricDate,
            senderDomain: event.senderDomain,
            recipientProvider: event.recipientProvider,
          },
        },
        create: {
          teamId: event.teamId,
          teamName: event.teamName,
          metricDate,
          senderDomain: event.senderDomain,
          recipientProvider: event.recipientProvider,
          ...increment,
        },
        update: Object.fromEntries(
          Object.entries(increment).map(([key, value]) => [key, { increment: value }])
        ),
      })
      return true
    })
  }
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"
}

function eventIncrement(type: DeliverabilityEventV1["type"]): Record<string, number> {
  const fieldByType = {
    sent: "sent",
    delivered: "delivered",
    hard_bounced: "hardBounced",
    soft_bounced: "softBounced",
    complained: "complained",
    human_opened: "humanOpened",
    clicked: "clicked",
    suppressed: "suppressed",
  } as const
  return { [fieldByType[type]]: 1 }
}

export const backofficeEmailDeliverabilityRepository = new BackofficeEmailDeliverabilityRepository()
