import type { EmailCampaign, EmailCampaignStatus, Prisma, PrismaClient } from "@prisma/client"
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

export type DispatchLogCounterRow = {
  dispatchId: string
  acceptedCount: number
  failedCount: number
  queuedCount: number
  /** Recusados pela pré-validação — terminais e não retentáveis. */
  suppressedCount: number
}

export type EmailCampaignCreateData = Prisma.EmailCampaignUncheckedCreateInput

export type CreatedSubCampaign = {
  id: string
  name: string
  description: string | null
  subCampaignIndex: number | null
  scheduledAt: Date | null
  totalRecipients: number
  status: EmailCampaignStatus
}

export type CreatedParentCampaign = EmailCampaign & {
  subCampaigns: CreatedSubCampaign[]
  subCampaignCount: number
  isParentCampaign: true
}

/**
 * `single` e `parent` são mutuamente exclusivos: ou a campanha é única, ou é uma
 * campanha-mãe com `children`. `radarSegmentLock`, quando presente, serializa a
 * criação contra a remoção concorrente do segmento custom (ver
 * `TeamRadarSegmentRepository.removeWithLock`, que usa a mesma chave).
 */
export type CreateCampaignPlanInput = {
  single: EmailCampaignCreateData | null
  parent: EmailCampaignCreateData | null
  children: EmailCampaignCreateData[]
  radarSegmentLock: { teamId: string; segmentId: string; lockKey: string } | null
}

export type CreateCampaignPlanResult = EmailCampaign | CreatedParentCampaign

const CREATED_SUB_CAMPAIGN_SELECT = {
  id: true,
  name: true,
  description: true,
  subCampaignIndex: true,
  scheduledAt: true,
  totalRecipients: true,
  status: true,
} as const

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
  /**
   * Contadores de `EmailLog` por dispatch, agregados no Postgres (não carrega N
   * logs na aplicação). Aceite = `sentAt` ou `resendEmailId`; `queued`/`failed`
   * só contam sem aceite. Dispatches sem log não aparecem no retorno.
   */
  aggregateDispatchLogCounters(
    teamId: string,
    dispatchIds: string[]
  ): Promise<DispatchLogCounterRow[]>
  /**
   * Cria a campanha (única ou mãe + filhas) numa única unidade de trabalho.
   * Retorna `null` quando o segmento Radar exigido pelo lock deixou de estar ativo.
   */
  createCampaignPlan(input: CreateCampaignPlanInput): Promise<CreateCampaignPlanResult | null>
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

  async aggregateDispatchLogCounters(
    teamId: string,
    dispatchIds: string[]
  ): Promise<DispatchLogCounterRow[]> {
    if (dispatchIds.length === 0) return []

    const rows = await this.db.$queryRaw<
      Array<{
        dispatchId: string
        acceptedCount: number | bigint
        failedCount: number | bigint
        queuedCount: number | bigint
        suppressedCount: number | bigint
      }>
    >`
      SELECT
        "dispatchId",
        COUNT(*) FILTER (
          WHERE "sentAt" IS NOT NULL OR "resendEmailId" IS NOT NULL
        )::int AS "acceptedCount",
        COUNT(*) FILTER (
          WHERE status = 'failed'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "failedCount",
        COUNT(*) FILTER (
          WHERE status = 'queued'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "queuedCount",
        -- Recusados pela pré-validação, antes de tocar o provedor. Sem esta
        -- coluna eles não entram em contador nenhum e a barra de progresso fica
        -- travada abaixo de 100% num disparo que já terminou.
        COUNT(*) FILTER (
          WHERE status = 'suppressed'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "suppressedCount"
      FROM "corretor_studio_email_logs"
      WHERE "teamId" = ${teamId}::uuid
        AND "dispatchId" = ANY(${dispatchIds}::uuid[])
      GROUP BY "dispatchId"
    `

    return rows
      .filter((row) => Boolean(row.dispatchId))
      .map((row) => ({
        dispatchId: row.dispatchId,
        acceptedCount: Number(row.acceptedCount),
        failedCount: Number(row.failedCount),
        queuedCount: Number(row.queuedCount),
        suppressedCount: Number(row.suppressedCount),
      }))
  }

  async createCampaignPlan(
    input: CreateCampaignPlanInput
  ): Promise<CreateCampaignPlanResult | null> {
    const { single, parent, children, radarSegmentLock } = input

    if (!radarSegmentLock) {
      if (single) return this.db.emailCampaign.create({ data: single })
      return this.db.$transaction((tx) => this.createParentWithChildren(tx, parent, children))
    }

    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${radarSegmentLock.lockKey}))`

      const stillActive = await tx.teamRadarSegment.findFirst({
        where: {
          id: radarSegmentLock.segmentId,
          teamId: radarSegmentLock.teamId,
          isActive: true,
        },
      })
      if (!stillActive) return null

      if (single) return tx.emailCampaign.create({ data: single })
      return this.createParentWithChildren(tx, parent, children)
    })
  }

  private async createParentWithChildren(
    tx: Prisma.TransactionClient,
    parent: EmailCampaignCreateData | null,
    children: EmailCampaignCreateData[]
  ): Promise<CreatedParentCampaign> {
    if (!parent) {
      throw new Error("createCampaignPlan exige `single` ou `parent` — ambos vieram nulos")
    }

    const createdParent = await tx.emailCampaign.create({ data: parent })

    const subCampaigns: CreatedSubCampaign[] = []
    for (const child of children) {
      const created = await tx.emailCampaign.create({
        data: child,
        select: CREATED_SUB_CAMPAIGN_SELECT,
      })
      subCampaigns.push(created)
    }

    return {
      ...createdParent,
      subCampaigns,
      subCampaignCount: subCampaigns.length,
      isParentCampaign: true,
    }
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
