import type { PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  isPgAdvisoryLockAcquired,
  resolveDispatchLockConnectionString,
  toDispatchAdvisoryLockKeys,
} from "@/lib/email/dispatch-advisory-lock"

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
  materializeSourceOffset: number
  createdAt: Date
}

export type DispatchCampaignSendState = {
  dispatchStatus: string
  campaignStatus: string
}

export type DispatchProcessingLockOutcome<T> =
  | { acquired: false }
  | { acquired: true; result: T }

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
  countEmailLogsForDispatch(dispatchId: string): Promise<number>
  findDispatchCampaignSendState(dispatchId: string): Promise<DispatchCampaignSendState | null>
  /**
   * Serializa o mesmo `dispatchId` numa conexão de sessão (DIRECT_URL).
   * Se o lock já estiver com outro isolate: `acquired: false` (ack, não reenviar).
   */
  runWithDispatchProcessingLock<T>(
    dispatchId: string,
    work: () => Promise<T>
  ): Promise<DispatchProcessingLockOutcome<T>>
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
      where: {
        status: "sending",
        OR: [
          { dispatches: { none: {} }, updatedAt: { lt: threshold } },
          {
            dispatches: {
              some: { status: "sending", createdAt: { lt: threshold } },
            },
          },
        ],
      },
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
        materializeSourceOffset: true,
        createdAt: true,
      },
      orderBy: { dispatchNumber: "desc" },
    })
  }

  async countQueuedEmailLogsForDispatch(dispatchId: string): Promise<number> {
    return this.db.emailLog.count({ where: { dispatchId, status: "queued" } })
  }

  async countEmailLogsForDispatch(dispatchId: string): Promise<number> {
    return this.db.emailLog.count({ where: { dispatchId } })
  }

  async findDispatchCampaignSendState(
    dispatchId: string
  ): Promise<DispatchCampaignSendState | null> {
    const row = await this.db.emailCampaignDispatch.findFirst({
      where: { id: dispatchId },
      select: { status: true, campaign: { select: { status: true } } },
    })
    if (!row) return null
    return { dispatchStatus: row.status, campaignStatus: row.campaign.status }
  }

  async runWithDispatchProcessingLock<T>(
    dispatchId: string,
    work: () => Promise<T>
  ): Promise<DispatchProcessingLockOutcome<T>> {
    const [classid, objid] = toDispatchAdvisoryLockKeys(dispatchId)
    const client = new Client({ connectionString: resolveDispatchLockConnectionString() })
    await client.connect()
    try {
      const lockResult = await client.query<{ acquired: unknown }>(
        "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
        [classid, objid]
      )
      if (!isPgAdvisoryLockAcquired(lockResult.rows[0]?.acquired)) {
        return { acquired: false }
      }
      try {
        const result = await work()
        return { acquired: true, result }
      } finally {
        await client.query("SELECT pg_advisory_unlock($1::integer, $2::integer)", [
          classid,
          objid,
        ])
      }
    } finally {
      await client.end()
    }
  }
}

export const emailCampaignRepository = new EmailCampaignRepository()
