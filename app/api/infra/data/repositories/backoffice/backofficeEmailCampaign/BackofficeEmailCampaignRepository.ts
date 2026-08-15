import {
  BackofficeEmailCampaignStatus,
  BackofficeEmailCampaignType,
  type BackofficeEmailCampaign,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeEmailCampaignInput,
  IBackofficeEmailCampaignRepository,
  UpdateBackofficeEmailCampaignCountersInput,
  UpdateBackofficeEmailCampaignInput,
} from "./IBackofficeEmailCampaignRepository"

const STUCK_SENDING_THRESHOLD_MINUTES = 30

export class BackofficeEmailCampaignRepository implements IBackofficeEmailCampaignRepository {
  async create(data: CreateBackofficeEmailCampaignInput): Promise<BackofficeEmailCampaign> {
    return prisma.backofficeEmailCampaign.create({
      data: {
        name: data.name,
        type: BackofficeEmailCampaignType.live_weekly,
        status: BackofficeEmailCampaignStatus.draft,
        contactListId: data.contactListId,
        scheduledAt: data.scheduledAt,
        resendTemplateId: data.resendTemplateId ?? null,
        resendTemplateName: data.resendTemplateName ?? null,
        fromName: data.fromName ?? null,
        fromEmail: data.fromEmail ?? null,
        replyTo: data.replyTo ?? null,
        createdByBackofficeUserId: data.createdByBackofficeUserId ?? null,
      },
    })
  }

  async findMany(): Promise<BackofficeEmailCampaign[]> {
    return prisma.backofficeEmailCampaign.findMany({
      orderBy: { scheduledAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeEmailCampaign | null> {
    return prisma.backofficeEmailCampaign.findUnique({ where: { id } })
  }

  async findUpcomingLiveCampaign(now: Date = new Date()): Promise<BackofficeEmailCampaign | null> {
    // Ignore stale draft/scheduled Live campaigns from past Thursdays so the
    // weekly provision cron and quick-entry opt-ins always target a future Live.
    return prisma.backofficeEmailCampaign.findFirst({
      where: {
        type: BackofficeEmailCampaignType.live_weekly,
        status: { in: [BackofficeEmailCampaignStatus.draft, BackofficeEmailCampaignStatus.scheduled] },
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: "asc" },
    })
  }

  async findDueForDispatch(now: Date): Promise<BackofficeEmailCampaign[]> {
    return prisma.backofficeEmailCampaign.findMany({
      where: {
        status: BackofficeEmailCampaignStatus.scheduled,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
    })
  }

  async update(
    id: string,
    data: UpdateBackofficeEmailCampaignInput
  ): Promise<BackofficeEmailCampaign> {
    return prisma.backofficeEmailCampaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contactListId !== undefined ? { contactListId: data.contactListId } : {}),
        ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
        ...(data.resendTemplateId !== undefined ? { resendTemplateId: data.resendTemplateId } : {}),
        ...(data.resendTemplateName !== undefined
          ? { resendTemplateName: data.resendTemplateName }
          : {}),
        ...(data.fromName !== undefined ? { fromName: data.fromName } : {}),
        ...(data.fromEmail !== undefined ? { fromEmail: data.fromEmail } : {}),
        ...(data.replyTo !== undefined ? { replyTo: data.replyTo } : {}),
      },
    })
  }

  async claimForDispatch(id: string): Promise<boolean> {
    const result = await prisma.backofficeEmailCampaign.updateMany({
      where: {
        id,
        status: { in: [BackofficeEmailCampaignStatus.draft, BackofficeEmailCampaignStatus.scheduled] },
      },
      data: { status: BackofficeEmailCampaignStatus.sending },
    })
    return result.count > 0
  }

  async markSent(
    id: string,
    dispatchCount: number,
    counters: UpdateBackofficeEmailCampaignCountersInput
  ): Promise<BackofficeEmailCampaign> {
    return prisma.backofficeEmailCampaign.update({
      where: { id },
      data: {
        status: BackofficeEmailCampaignStatus.sent,
        sentAt: new Date(),
        dispatchCount,
        ...counters,
      },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<BackofficeEmailCampaign> {
    return prisma.backofficeEmailCampaign.update({
      where: { id },
      data: { status: BackofficeEmailCampaignStatus.failed, errorMessage },
    })
  }

  async cancel(id: string): Promise<BackofficeEmailCampaign | null> {
    const result = await prisma.backofficeEmailCampaign.updateMany({
      where: {
        id,
        status: { in: [BackofficeEmailCampaignStatus.draft, BackofficeEmailCampaignStatus.scheduled] },
      },
      data: { status: BackofficeEmailCampaignStatus.canceled },
    })
    if (result.count === 0) return null
    return prisma.backofficeEmailCampaign.findUnique({ where: { id } })
  }

  async findStuckSending(olderThan: Date): Promise<BackofficeEmailCampaign[]> {
    return prisma.backofficeEmailCampaign.findMany({
      where: {
        status: BackofficeEmailCampaignStatus.sending,
        updatedAt: { lt: olderThan },
      },
    })
  }

  async incrementCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignCountersInput
  ): Promise<void> {
    await prisma.backofficeEmailCampaign.update({
      where: { id },
      data: {
        ...(counters.totalRecipients !== undefined
          ? { totalRecipients: { increment: counters.totalRecipients } }
          : {}),
        ...(counters.totalSent !== undefined ? { totalSent: { increment: counters.totalSent } } : {}),
        ...(counters.totalDelivered !== undefined
          ? { totalDelivered: { increment: counters.totalDelivered } }
          : {}),
        ...(counters.totalOpened !== undefined
          ? { totalOpened: { increment: counters.totalOpened } }
          : {}),
        ...(counters.totalClicked !== undefined
          ? { totalClicked: { increment: counters.totalClicked } }
          : {}),
        ...(counters.totalBounced !== undefined
          ? { totalBounced: { increment: counters.totalBounced } }
          : {}),
        ...(counters.totalComplained !== undefined
          ? { totalComplained: { increment: counters.totalComplained } }
          : {}),
      },
    })
  }

  async updateStatus(id: string, status: BackofficeEmailCampaignStatus): Promise<void> {
    await prisma.backofficeEmailCampaign.update({ where: { id }, data: { status } })
  }
}

export const backofficeEmailCampaignRepository = new BackofficeEmailCampaignRepository()
export const STUCK_SENDING_THRESHOLD_MS = STUCK_SENDING_THRESHOLD_MINUTES * 60 * 1000
