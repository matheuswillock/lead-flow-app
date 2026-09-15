import type { EmailCampaignStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import {
  getTeamDailyDispatchStatus,
  type DailyEmailCapResult,
} from "@/lib/email/campaign-daily-dispatch-guard"

/**
 * Motivo estruturado do adiamento/bloqueio de disparo. `null` significa
 * "disponível agora" — o front nunca precisa inventar um motivo próprio.
 */
export type DispatchAvailabilityReason =
  | "already_sent"
  | "dispatch_in_progress"
  | "monthly_quota_active"
  | "daily_cap_reached"
  | null

export type DispatchAvailability = {
  canDispatchNow: boolean
  reason: DispatchAvailabilityReason
  /** `null` quando o time tem grant ilimitado. */
  dailyCap: number | null
  sentToday: number
  isUnlimitedDailyCap: boolean
  /**
   * ISO da próxima meia-noite civil do time (fuso do dono). NECESSÁRIO mas
   * não SUFICIENTE: se houver partes mais antigas na fila, a próxima janela
   * pode não ser a DESTA parte — ver `queuedAheadCount`.
   */
  nextWindowAt: string
  /**
   * Quantas outras partes do mesmo time, já vencidas (agendadas para agora ou
   * antes) e mais antigas que esta, ainda aguardam disparo. `null` quando não
   * calculado (motivo não é `daily_cap_reached`, ou não aplicável).
   */
  queuedAheadCount: number | null
}

/** Status em que a campanha/parte ainda pode ser disparada manualmente. */
const DISPATCHABLE_STATUSES = new Set<EmailCampaignStatus>([
  "draft",
  "scheduled",
  "failed",
  "partially_sent",
])

/**
 * Decide o veredito a partir de números JÁ resolvidos — pura, sem I/O, para
 * ser testável sem banco. Espelha exatamente as checagens de
 * `dispatchScheduledCampaigns`/`startManualDispatch`: mesma fonte
 * (`dailyStatus` vem de `getTeamDailyDispatchStatus`), nunca uma cópia da
 * regra do teto.
 */
export function resolveDispatchAvailability(params: {
  status: EmailCampaignStatus
  monthlyQuotaActive: boolean
  dailyStatus: DailyEmailCapResult
  /** Destinatários que este disparo consumiria do teto (retry-only já filtrado pelo chamador). */
  additionalRecipients: number
  now: Date
  timezone: string
  queuedAheadCount?: number | null
}): DispatchAvailability {
  const nextWindowAt = addDaysInTz(
    startOfDayInTz(params.now, params.timezone),
    1,
    params.timezone
  ).toISOString()

  const base = {
    dailyCap: params.dailyStatus.limit,
    sentToday: params.dailyStatus.used,
    isUnlimitedDailyCap: params.dailyStatus.isUnlimited,
    nextWindowAt,
  }

  if (params.status === "sending") {
    return { canDispatchNow: false, reason: "dispatch_in_progress", queuedAheadCount: null, ...base }
  }

  if (params.status === "sent") {
    return { canDispatchNow: false, reason: "already_sent", queuedAheadCount: null, ...base }
  }

  if (!DISPATCHABLE_STATUSES.has(params.status)) {
    // canceled/archived: sem ação manual, sem motivo nomeado (a UI já não
    // mostra o botão para estes status).
    return { canDispatchNow: false, reason: null, queuedAheadCount: null, ...base }
  }

  if (params.monthlyQuotaActive) {
    return { canDispatchNow: false, reason: "monthly_quota_active", queuedAheadCount: null, ...base }
  }

  const wouldExceed =
    !params.dailyStatus.isUnlimited &&
    params.dailyStatus.limit != null &&
    params.additionalRecipients > 0 &&
    params.dailyStatus.used + params.additionalRecipients > params.dailyStatus.limit

  if (wouldExceed) {
    return {
      canDispatchNow: false,
      reason: "daily_cap_reached",
      queuedAheadCount: params.queuedAheadCount ?? null,
      ...base,
    }
  }

  return { canDispatchNow: true, reason: null, queuedAheadCount: null, ...base }
}

export type LeafDispatchAvailabilityInput = {
  id: string
  status: EmailCampaignStatus
  totalRecipients: number
  totalSent: number
  scheduledAt: Date | null
  /** true quando o disparo real seria retry-only (failed/partially_sent com totalSent>0). */
  retryFailedOnly: boolean
}

/**
 * Conta, para uma parte agendada e vencida, quantas outras partes do mesmo
 * time também já venceram (`scheduledAt <= now`) e são mais antigas —
 * candidatas a sair primeiro na próxima folga de teto. Só roda quando o
 * motivo já é `daily_cap_reached`: consulta desnecessária nos demais casos.
 */
async function countScheduledPartsAhead(params: {
  teamId: string
  now: Date
  scheduledAt: Date | null
  excludeCampaignId: string
}): Promise<number> {
  if (!params.scheduledAt) return 0
  return prisma.emailCampaign.count({
    where: {
      teamId: params.teamId,
      id: { not: params.excludeCampaignId },
      status: "scheduled",
      scheduledAt: { lte: params.now, lt: params.scheduledAt },
    },
  })
}

/**
 * Orquestra a resolução para um lote de partes/campanhas-folha do mesmo time:
 * uma única leitura do teto diário (`getTeamDailyDispatchStatus`) para o lote
 * inteiro — nunca uma consulta por linha.
 */
export async function loadDispatchAvailabilityForLeafCampaigns(params: {
  teamId: string
  timezone: string
  now: Date
  monthlyQuotaActive: boolean
  campaigns: LeafDispatchAvailabilityInput[]
}): Promise<Map<string, DispatchAvailability>> {
  const result = new Map<string, DispatchAvailability>()
  if (params.campaigns.length === 0) return result

  const dailyStatus = await getTeamDailyDispatchStatus({
    teamId: params.teamId,
    timezone: params.timezone,
    now: params.now,
  })

  for (const campaign of params.campaigns) {
    const additionalRecipients = campaign.retryFailedOnly
      ? Math.max(0, campaign.totalRecipients - campaign.totalSent)
      : campaign.totalRecipients

    const availability = resolveDispatchAvailability({
      status: campaign.status,
      monthlyQuotaActive: params.monthlyQuotaActive,
      dailyStatus,
      additionalRecipients,
      now: params.now,
      timezone: params.timezone,
    })

    if (availability.reason === "daily_cap_reached") {
      const queuedAheadCount = await countScheduledPartsAhead({
        teamId: params.teamId,
        now: params.now,
        scheduledAt: campaign.scheduledAt,
        excludeCampaignId: campaign.id,
      })
      result.set(campaign.id, { ...availability, queuedAheadCount })
      continue
    }

    result.set(campaign.id, availability)
  }

  return result
}
