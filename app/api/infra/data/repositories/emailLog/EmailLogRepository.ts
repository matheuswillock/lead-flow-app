import { prisma } from "@/app/api/infra/data/prisma"
import { Prisma } from "@prisma/client"
import type {
  ApplyEmailLogWebhookInput,
  CreateTeamEmailLogInput,
  IEmailLogRepository,
  MarkSentEntry,
} from "./IEmailLogRepository"
import type { EmailEventType } from "@prisma/client"

export class EmailLogRepository implements IEmailLogRepository {
  async findByResendEmailId(resendEmailId: string) {
    return prisma.emailLog.findUnique({
      where: { resendEmailId },
      select: {
        id: true,
        teamId: true,
        status: true,
        recipientEmail: true,
        recipientName: true,
        campaignId: true,
        dispatchId: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        complainedAt: true,
      },
    })
  }

  async hasDuplicateEvent(logId: string, eventType: EmailEventType, occurredAt: Date) {
    const duplicate = await prisma.emailEvent.findFirst({
      where: { logId, type: eventType, occurredAt },
      select: { id: true },
    })
    return Boolean(duplicate)
  }

  async applyWebhookEvent(input: ApplyEmailLogWebhookInput): Promise<void> {
    const { log, eventType, occurredAt, metadata, eventId } = input

    const timestampField: Partial<Record<EmailEventType, string>> = {
      delivered: "deliveredAt",
      opened: "openedAt",
      clicked: "clickedAt",
      bounced: "bouncedAt",
      complained: "complainedAt",
    }

    const timestampUpdate = timestampField[eventType]
      ? { [timestampField[eventType]!]: occurredAt }
      : {}

    const statusPriority: string[] = [
      "complained", "bounced", "failed", "clicked", "opened", "delivered", "sent", "queued",
    ]
    const currentStatusIdx = statusPriority.indexOf(log.status as EmailEventType)
    const newStatusIdx = statusPriority.indexOf(eventType)
    const shouldUpdateStatus = newStatusIdx !== -1 && (currentStatusIdx === -1 || newStatusIdx < currentStatusIdx)

    await prisma.$transaction(async (tx) => {
      await tx.emailEvent.create({
        data: {
          id: eventId,
          logId: log.id,
          type: eventType,
          occurredAt,
          metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      })

      await tx.emailLog.update({
        where: { id: log.id },
        data: {
          ...(shouldUpdateStatus && { status: eventType as never }),
          ...timestampUpdate,
        },
      })

      if (eventType === "bounced") {
        await tx.emailContact.updateMany({
          where: { email: log.recipientEmail },
          data: { isBounced: true },
        })
      }
      if (eventType === "complained") {
        await tx.emailContact.updateMany({
          where: { email: log.recipientEmail },
          data: { isComplained: true, isUnsubscribed: true },
        })
      }

      if (log.campaignId) {
        const campaignIncrements: Record<string, number> = {}
        if (eventType === "delivered" && !log.deliveredAt) campaignIncrements.totalDelivered = 1
        if (eventType === "opened" && !log.openedAt) campaignIncrements.totalOpened = 1
        if (eventType === "clicked" && !log.clickedAt) campaignIncrements.totalClicked = 1
        if (eventType === "bounced" && !log.bouncedAt) campaignIncrements.totalBounced = 1
        if (eventType === "complained" && !log.complainedAt) campaignIncrements.totalComplained = 1

        if (Object.keys(campaignIncrements).length > 0) {
          await tx.emailCampaign.update({
            where: { id: log.campaignId },
            data: Object.fromEntries(
              Object.entries(campaignIncrements).map(([k, v]) => [k, { increment: v }])
            ),
          })

          if (log.dispatchId) {
            await tx.emailCampaignDispatch.update({
              where: { id: log.dispatchId },
              data: Object.fromEntries(
                Object.entries(campaignIncrements).map(([k, v]) => [k, { increment: v }])
              ),
            })
          }
        }
      }
    })
  }

  async createQueuedLog(input: CreateTeamEmailLogInput): Promise<string> {
    await prisma.emailLog.create({
      data: {
        id: input.id,
        teamId: input.teamId,
        campaignId: input.campaignId ?? null,
        dispatchId: input.dispatchId ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        subject: input.subject,
        category: input.category,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        status: "queued",
      },
    })
    return input.id
  }

  async createManyQueuedLogs(inputs: CreateTeamEmailLogInput[]): Promise<void> {
    if (inputs.length === 0) return
    await prisma.emailLog.createMany({
      data: inputs.map((input) => ({
        id: input.id,
        teamId: input.teamId,
        campaignId: input.campaignId ?? null,
        dispatchId: input.dispatchId ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        subject: input.subject,
        category: input.category,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        status: "queued" as const,
      })),
    })
  }

  async markManySent(entries: MarkSentEntry[], sentAt: Date): Promise<void> {
    if (entries.length === 0) return
    // Batch de updates em uma única round-trip (transação em lote do Prisma).
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.emailLog.update({
          where: { id: entry.logId },
          data: {
            resendEmailId: entry.resendEmailId,
            status: "sent",
            sentAt,
          },
        })
      )
    )
  }

  async markSent(logId: string, resendEmailId: string, sentAt: Date): Promise<void> {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        resendEmailId,
        status: "sent",
        sentAt,
      },
    })
  }

  async markFailed(
    logId: string,
    eventId: string,
    errorMessage: string,
    occurredAt: Date
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailLog.update({
        where: { id: logId },
        data: { status: "failed" },
      })

      await tx.emailEvent.create({
        data: {
          id: eventId,
          logId,
          type: "failed",
          occurredAt,
          metadata: { errorMessage },
        },
      })
    })
  }
}

export const emailLogRepository = new EmailLogRepository()
