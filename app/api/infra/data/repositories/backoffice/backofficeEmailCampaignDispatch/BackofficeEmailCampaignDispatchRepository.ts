import {
  BackofficeEmailCampaignDispatchStatus,
  type BackofficeEmailCampaignDispatch,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeEmailCampaignDispatchInput,
  IBackofficeEmailCampaignDispatchRepository,
  UpdateBackofficeEmailCampaignDispatchCountersInput,
} from "./IBackofficeEmailCampaignDispatchRepository"

export class BackofficeEmailCampaignDispatchRepository
  implements IBackofficeEmailCampaignDispatchRepository
{
  async create(
    data: CreateBackofficeEmailCampaignDispatchInput
  ): Promise<BackofficeEmailCampaignDispatch> {
    const last = await prisma.backofficeEmailCampaignDispatch.findFirst({
      where: { campaignId: data.campaignId },
      orderBy: { dispatchNumber: "desc" },
      select: { dispatchNumber: true },
    })
    const dispatchNumber = (last?.dispatchNumber ?? 0) + 1

    return prisma.backofficeEmailCampaignDispatch.create({
      data: {
        campaignId: data.campaignId,
        dispatchNumber,
        templateSubjectSnapshot: data.templateSubjectSnapshot,
        templateHtmlSnapshot: data.templateHtmlSnapshot,
        resendTemplateIdSnapshot: data.resendTemplateIdSnapshot ?? null,
        triggeredByBackofficeUserId: data.triggeredByBackofficeUserId ?? null,
      },
    })
  }

  async findByCampaignId(campaignId: string): Promise<BackofficeEmailCampaignDispatch[]> {
    return prisma.backofficeEmailCampaignDispatch.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    })
  }

  async updateStatus(
    id: string,
    status: BackofficeEmailCampaignDispatchStatus,
    errorMessage?: string | null
  ): Promise<void> {
    await prisma.backofficeEmailCampaignDispatch.update({
      where: { id },
      data: { status, ...(errorMessage !== undefined ? { errorMessage } : {}) },
    })
  }

  async updateCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignDispatchCountersInput
  ): Promise<void> {
    await prisma.backofficeEmailCampaignDispatch.update({
      where: { id },
      data: counters,
    })
  }

  async incrementCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignDispatchCountersInput
  ): Promise<void> {
    await prisma.backofficeEmailCampaignDispatch.update({
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
}

export const backofficeEmailCampaignDispatchRepository =
  new BackofficeEmailCampaignDispatchRepository()
