import { prisma } from "@/app/api/infra/data/prisma"

export type CampaignForSegmentGeneration = {
  id: string
  sentAt: Date | null
  status: string
}

export interface IEmailCampaignRepository {
  findForSegmentGeneration(
    teamId: string,
    campaignId: string
  ): Promise<CampaignForSegmentGeneration | null>
}

export class EmailCampaignRepository implements IEmailCampaignRepository {
  async findForSegmentGeneration(teamId: string, campaignId: string) {
    return prisma.emailCampaign.findFirst({
      where: { id: campaignId, teamId },
      select: { id: true, sentAt: true, status: true },
    })
  }
}

export const emailCampaignRepository = new EmailCampaignRepository()
