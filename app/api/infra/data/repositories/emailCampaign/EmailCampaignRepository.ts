import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type CampaignForSegmentGeneration = {
  id: string
  sentAt: Date | null
  status: string
}

export type StuckSendingCampaign = {
  id: string
  name: string
  dispatchCount: number
}

export type SendingDispatchForReconciliation = {
  id: string
  campaignId: string
  teamId: string
  totalRecipients: number
  reservedCredits: number
  hasCampaignsBetaAccess: boolean
}

export interface IEmailCampaignRepository {
  findForSegmentGeneration(
    teamId: string,
    campaignId: string
  ): Promise<CampaignForSegmentGeneration | null>
  /** Campanhas em `sending` há mais de `threshold` — candidatas a recovery. */
  findStuckSendingCampaigns(threshold: Date): Promise<StuckSendingCampaign[]>
  /** Campanhas travadas em `sending` sem nenhum dispatch — nunca chegaram a criar o registro de envio. */
  revertOrphanCampaignsToDraft(campaignIds: string[], errorMessage: string): Promise<void>
  /** Dispatch `sending` mais recente de uma campanha, para reconciliar o status real. */
  findSendingDispatchForCampaign(
    campaignId: string
  ): Promise<SendingDispatchForReconciliation | null>
  countQueuedEmailLogsForDispatch(dispatchId: string): Promise<number>
}

export class EmailCampaignRepository implements IEmailCampaignRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findForSegmentGeneration(teamId: string, campaignId: string) {
    return this.db.emailCampaign.findFirst({
      where: { id: campaignId, teamId },
      select: { id: true, sentAt: true, status: true },
    })
  }

  async findStuckSendingCampaigns(threshold: Date): Promise<StuckSendingCampaign[]> {
    const campaigns = await this.db.emailCampaign.findMany({
      where: { status: "sending", updatedAt: { lt: threshold } },
      select: { id: true, name: true, _count: { select: { dispatches: true } } },
    })
    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      dispatchCount: campaign._count.dispatches,
    }))
  }

  async revertOrphanCampaignsToDraft(campaignIds: string[], errorMessage: string): Promise<void> {
    if (campaignIds.length === 0) return
    await this.db.emailCampaign.updateMany({
      where: { id: { in: campaignIds } },
      data: { status: "draft", errorMessage },
    })
  }

  async findSendingDispatchForCampaign(
    campaignId: string
  ): Promise<SendingDispatchForReconciliation | null> {
    return this.db.emailCampaignDispatch.findFirst({
      where: { campaignId, status: "sending" },
      select: {
        id: true,
        campaignId: true,
        teamId: true,
        totalRecipients: true,
        reservedCredits: true,
        hasCampaignsBetaAccess: true,
      },
      orderBy: { dispatchNumber: "desc" },
    })
  }

  async countQueuedEmailLogsForDispatch(dispatchId: string): Promise<number> {
    return this.db.emailLog.count({ where: { dispatchId, status: "queued" } })
  }
}

export const emailCampaignRepository = new EmailCampaignRepository()
