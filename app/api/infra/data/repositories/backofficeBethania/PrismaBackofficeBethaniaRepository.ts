import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeBethaniaRepository,
  BethaniaDeliveryLogRecord,
  BethaniaEventControlRecord,
} from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaRepository"

export class PrismaBackofficeBethaniaRepository implements BackofficeBethaniaRepository {
  async getGlobalPause(): Promise<boolean> {
    const record = await prisma.bethaniaGlobalControl.findUnique({
      where: { id: "global" },
      select: { paused: true },
    })
    return record?.paused ?? false
  }

  async listEventControls(): Promise<BethaniaEventControlRecord[]> {
    return prisma.bethaniaEventControl.findMany({
      select: { eventType: true, paused: true },
    })
  }

  async setGlobalPause(input: { paused: boolean; actorProfileId: string }): Promise<void> {
    await prisma.bethaniaGlobalControl.upsert({
      where: { id: "global" },
      create: { id: "global", paused: input.paused, updatedByProfileId: input.actorProfileId },
      update: { paused: input.paused, updatedByProfileId: input.actorProfileId },
    })
  }

  async setEventPause(input: { eventType: string; paused: boolean; actorProfileId: string }): Promise<void> {
    await prisma.bethaniaEventControl.upsert({
      where: { eventType: input.eventType },
      create: { eventType: input.eventType, paused: input.paused, updatedByProfileId: input.actorProfileId },
      update: { paused: input.paused, updatedByProfileId: input.actorProfileId },
    })
  }

  async getSenderConfig(): Promise<{ webhookUrl: string } | null> {
    return prisma.bethaniaSenderConfig.findUnique({
      where: { id: "singleton" },
      select: { webhookUrl: true },
    })
  }

  async upsertSenderConfig(input: { webhookUrl: string; actorProfileId: string }): Promise<{
    webhookUrl: string
    updatedByProfileId: string | null
  }> {
    return prisma.bethaniaSenderConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", webhookUrl: input.webhookUrl, updatedByProfileId: input.actorProfileId },
      update: { webhookUrl: input.webhookUrl, updatedByProfileId: input.actorProfileId },
      select: { webhookUrl: true, updatedByProfileId: true },
    })
  }

  async listLogs(input: {
    eventType?: string
    status?: string
    skip: number
    take: number
  }): Promise<{ rows: BethaniaDeliveryLogRecord[]; total: number }> {
    const where: Record<string, string> = {}
    if (input.eventType) where.eventType = input.eventType
    if (input.status) where.status = input.status

    const [rows, total] = await Promise.all([
      prisma.bethaniaDeliveryLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: input.skip,
        take: input.take,
        select: {
          id: true,
          eventType: true,
          status: true,
          errorCode: true,
          createdAt: true,
          outbox: { select: { attempts: true } },
        },
      }),
      prisma.bethaniaDeliveryLog.count({ where }),
    ])

    return {
      rows: rows.map(({ id, eventType, status, errorCode, createdAt, outbox }) => ({
        id,
        eventType,
        status,
        errorCode,
        createdAt,
        attempts: outbox?.attempts ?? 0,
      })),
      total,
    }
  }
}

export const backofficeBethaniaRepository = new PrismaBackofficeBethaniaRepository()
