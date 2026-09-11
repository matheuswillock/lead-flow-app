import type { EmailCampaign, EmailCampaignStatus, Prisma, PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  isPgAdvisoryLockAcquired,
  resolveDispatchLockConnectionString,
  toDispatchAdvisoryLockKeys,
} from "@/lib/email/dispatch-advisory-lock"
import {
  queryDispatchLogCounters,
  type DispatchLogCounterRow,
} from "@/app/api/infra/data/repositories/emailLog/DispatchLogCountersQuery"
import type {
  CampaignCounters,
  CounterFix,
  CounterSnapshot,
  DispatchCounters,
} from "@/lib/email/campaign-counter-reconciliation"

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

export type { DispatchLogCounterRow }

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
  /**
   * Campanhas cujo contador denormalizado diverge dos logs. Exclui o que está em
   * voo (campanha ou disparo `sending` com atividade depois do watermark) — o
   * webhook incrementa o mesmo contador e a leitura correria com a escrita.
   */
  findCampaignCounterSnapshots(
    options: CounterReconciliationQueryOptions
  ): Promise<CounterSnapshot<CampaignCounters>[]>
  /** Idem, por disparo. */
  findDispatchCounterSnapshots(
    options: CounterReconciliationQueryOptions
  ): Promise<CounterSnapshot<DispatchCounters>[]>
  /** Devolve quantas linhas foram de fato corrigidas (ver nota de concorrência). */
  applyCampaignCounterFixes(fixes: CounterFix<CampaignCounters>[]): Promise<number>
  applyDispatchCounterFixes(fixes: CounterFix<DispatchCounters>[]): Promise<number>
  /**
   * Último disparo abortado por cota mensal desde `since`, ou `null`.
   *
   * A cota é da **conta** no provedor, não do time — por isso a busca é global.
   * O registro do incidente é o próprio `errorMessage` do disparo (comparado
   * com `quotaFailureMessage`, a constante que o escreve): não há tabela de
   * incidente e a decisão foi não criar uma. O preço é o acoplamento à cópia —
   * mudar a mensagem sem mudar este chamador cega a recusa, e é por isso que a
   * constante viaja como parâmetro em vez de ser duplicada aqui.
   */
  findLastMonthlyQuotaIncidentAt(options: {
    since: Date
    quotaFailureMessage: string
  }): Promise<Date | null>
}

export type CounterReconciliationQueryOptions = {
  limit: number
  /** Linhas `sending` com `updatedAt` a partir daqui são consideradas em voo. */
  inFlightWatermark: Date
}

type CounterDriftRow = {
  id: string
  currentTotalSent: number
  currentTotalDelivered: number
  currentTotalOpened: number
  currentTotalClicked: number
  currentTotalBounced: number
  currentTotalComplained: number
  computedTotalSent: number
  computedTotalDelivered: number
  computedTotalOpened: number
  computedTotalClicked: number
  computedTotalBounced: number
  computedTotalComplained: number
}

function toCounterSnapshot(row: CounterDriftRow): CounterSnapshot<CampaignCounters> {
  return {
    id: row.id,
    current: {
      totalSent: Number(row.currentTotalSent),
      totalDelivered: Number(row.currentTotalDelivered),
      totalOpened: Number(row.currentTotalOpened),
      totalClicked: Number(row.currentTotalClicked),
      totalBounced: Number(row.currentTotalBounced),
      totalComplained: Number(row.currentTotalComplained),
    },
    computed: {
      totalSent: Number(row.computedTotalSent),
      totalDelivered: Number(row.computedTotalDelivered),
      totalOpened: Number(row.computedTotalOpened),
      totalClicked: Number(row.computedTotalClicked),
      totalBounced: Number(row.computedTotalBounced),
      totalComplained: Number(row.computedTotalComplained),
    },
  }
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
    return queryDispatchLogCounters(this.db, { teamId, dispatchIds })
  }

  async findCampaignCounterSnapshots(
    options: CounterReconciliationQueryOptions
  ): Promise<CounterSnapshot<CampaignCounters>[]> {
    const rows = await this.db.$queryRaw<CounterDriftRow[]>`
      WITH agg AS (
        SELECT
          "campaignId" AS "id",
          COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL OR "resendEmailId" IS NOT NULL)::int AS "totalSent",
          COUNT(*) FILTER (WHERE "deliveredAt" IS NOT NULL)::int AS "totalDelivered",
          COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL)::int AS "totalOpened",
          COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL)::int AS "totalClicked",
          COUNT(*) FILTER (WHERE "bouncedAt" IS NOT NULL)::int AS "totalBounced",
          COUNT(*) FILTER (WHERE "complainedAt" IS NOT NULL)::int AS "totalComplained"
        FROM "corretor_studio_email_logs"
        WHERE "campaignId" IS NOT NULL
        GROUP BY "campaignId"
      )
      SELECT
        c."id",
        c."totalSent" AS "currentTotalSent",
        c."totalDelivered" AS "currentTotalDelivered",
        c."totalOpened" AS "currentTotalOpened",
        c."totalClicked" AS "currentTotalClicked",
        c."totalBounced" AS "currentTotalBounced",
        c."totalComplained" AS "currentTotalComplained",
        a."totalSent" AS "computedTotalSent",
        a."totalDelivered" AS "computedTotalDelivered",
        a."totalOpened" AS "computedTotalOpened",
        a."totalClicked" AS "computedTotalClicked",
        a."totalBounced" AS "computedTotalBounced",
        a."totalComplained" AS "computedTotalComplained"
      FROM "corretor_studio_email_campaigns" c
      JOIN agg a ON a."id" = c."id"
      WHERE NOT (
              c."status" = 'sending'::"email_campaign_status"
              AND c."updatedAt" >= ${options.inFlightWatermark}
            )
        AND NOT EXISTS (
              SELECT 1
              FROM "corretor_studio_email_campaign_dispatches" d
              WHERE d."campaignId" = c."id"
                AND d."status" = 'sending'::"email_campaign_dispatch_status"
                AND d."updatedAt" >= ${options.inFlightWatermark}
            )
        AND (
              c."totalSent" <> a."totalSent"
              OR c."totalDelivered" <> a."totalDelivered"
              OR c."totalOpened" <> a."totalOpened"
              OR c."totalClicked" <> a."totalClicked"
              OR c."totalBounced" <> a."totalBounced"
              OR c."totalComplained" <> a."totalComplained"
            )
      ORDER BY c."updatedAt" ASC
      LIMIT ${options.limit}
    `

    return rows.map(toCounterSnapshot)
  }

  async findDispatchCounterSnapshots(
    options: CounterReconciliationQueryOptions
  ): Promise<CounterSnapshot<DispatchCounters>[]> {
    const rows = await this.db.$queryRaw<CounterDriftRow[]>`
      WITH agg AS (
        SELECT
          "dispatchId" AS "id",
          COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL OR "resendEmailId" IS NOT NULL)::int AS "totalSent",
          COUNT(*) FILTER (WHERE "deliveredAt" IS NOT NULL)::int AS "totalDelivered",
          COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL)::int AS "totalOpened",
          COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL)::int AS "totalClicked",
          COUNT(*) FILTER (WHERE "bouncedAt" IS NOT NULL)::int AS "totalBounced",
          COUNT(*) FILTER (WHERE "complainedAt" IS NOT NULL)::int AS "totalComplained"
        FROM "corretor_studio_email_logs"
        WHERE "dispatchId" IS NOT NULL
        GROUP BY "dispatchId"
      )
      SELECT
        d."id",
        d."totalSent" AS "currentTotalSent",
        d."totalDelivered" AS "currentTotalDelivered",
        d."totalOpened" AS "currentTotalOpened",
        d."totalClicked" AS "currentTotalClicked",
        d."totalBounced" AS "currentTotalBounced",
        d."totalComplained" AS "currentTotalComplained",
        a."totalSent" AS "computedTotalSent",
        a."totalDelivered" AS "computedTotalDelivered",
        a."totalOpened" AS "computedTotalOpened",
        a."totalClicked" AS "computedTotalClicked",
        a."totalBounced" AS "computedTotalBounced",
        a."totalComplained" AS "computedTotalComplained"
      FROM "corretor_studio_email_campaign_dispatches" d
      JOIN agg a ON a."id" = d."id"
      WHERE NOT (
              d."status" = 'sending'::"email_campaign_dispatch_status"
              AND d."updatedAt" >= ${options.inFlightWatermark}
            )
        AND (
              d."totalSent" <> a."totalSent"
              OR d."totalDelivered" <> a."totalDelivered"
              OR d."totalOpened" <> a."totalOpened"
              OR d."totalClicked" <> a."totalClicked"
              OR d."totalBounced" <> a."totalBounced"
              OR d."totalComplained" <> a."totalComplained"
            )
      ORDER BY d."updatedAt" ASC
      LIMIT ${options.limit}
    `

    return rows.map(toCounterSnapshot)
  }

  /**
   * Escrita com concorrência otimista: o `where` repete os valores lidos no
   * snapshot, então a linha só é corrigida se **ninguém** a mexeu no intervalo.
   *
   * Sem isso, um webhook de abertura/clique que aterrissa entre a leitura e a
   * escrita seria sobrescrito pelo valor velho e o incremento se perderia até a
   * próxima noite. Campanha terminal recebe esses eventos por semanas, então a
   * janela não é teórica. Perder a correção é barato (volta amanhã); perder o
   * evento do webhook, não.
   *
   * Uma transação por passe: ou a noite inteira entra, ou nenhuma linha entra.
   */
  async applyCampaignCounterFixes(fixes: CounterFix<CampaignCounters>[]): Promise<number> {
    if (fixes.length === 0) return 0
    const results = await this.db.$transaction(
      fixes.map((fix) =>
        this.db.emailCampaign.updateMany({
          where: { id: fix.id, ...fix.expected },
          data: fix.counters,
        })
      )
    )
    return results.reduce((total, result) => total + result.count, 0)
  }

  async applyDispatchCounterFixes(fixes: CounterFix<DispatchCounters>[]): Promise<number> {
    if (fixes.length === 0) return 0
    const results = await this.db.$transaction(
      fixes.map((fix) =>
        this.db.emailCampaignDispatch.updateMany({
          where: { id: fix.id, ...fix.expected },
          data: fix.counters,
        })
      )
    )
    return results.reduce((total, result) => total + result.count, 0)
  }

  async findLastMonthlyQuotaIncidentAt(options: {
    since: Date
    quotaFailureMessage: string
  }): Promise<Date | null> {
    // A âncora é `dispatchedAt`, não `updatedAt`. `updatedAt` é mexido por
    // qualquer webhook de abertura/entrega que aterrisse depois — e agora também
    // pela reconciliação noturna de contadores. Um disparo abortado por cota em
    // agosto que recebesse uma abertura em setembro voltaria a parecer incidente
    // do mês corrente e bloquearia **todas** as campanhas, manuais e agendadas,
    // pelo resto de setembro. `dispatchedAt` é `@default(now())` e nunca é
    // reescrito: o disparo fica carimbado no mês em que aconteceu.
    const incident = await this.db.emailCampaignDispatch.findFirst({
      where: {
        errorMessage: options.quotaFailureMessage,
        dispatchedAt: { gte: options.since },
      },
      select: { dispatchedAt: true },
      orderBy: { dispatchedAt: "desc" },
    })
    return incident?.dispatchedAt ?? null
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
