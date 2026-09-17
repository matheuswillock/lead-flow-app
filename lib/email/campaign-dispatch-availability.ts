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
  /**
   * Contagem EXATA de destinatários que o disparo consumiria, quando o
   * chamador já a computou (ex.: retry-only com contagem real dos logs
   * falhados na ficha individual). `null`/ausente → heurística persistida
   * (`totalRecipients - totalSent` para retry; `totalRecipients` para envio
   * normal). Achado codex P2 no PR #1178: os totais persistidos podem
   * divergir do público real do disparo.
   */
  exactAdditionalRecipients?: number | null
}

/**
 * Fila de partes vencidas do time (`scheduled`, `scheduledAt <= now`) numa
 * ÚNICA consulta para o lote inteiro — a listagem aceita até 100 linhas e um
 * COUNT por linha custaria até 100 idas sequenciais ao banco exatamente
 * durante o incidente que esta UI existe para expor (achado codex P2,
 * PR #1178). A posição de cada parte é derivada em memória com a MESMA
 * semântica do COUNT antigo: estritamente mais antigas (`<`), excluindo a
 * própria linha.
 */
async function listDueScheduledParts(params: {
  teamId: string
  now: Date
}): Promise<Array<{ id: string; scheduledAt: Date | null }>> {
  return prisma.emailCampaign.findMany({
    where: {
      teamId: params.teamId,
      status: "scheduled",
      scheduledAt: { lte: params.now },
    },
    select: { id: true, scheduledAt: true },
  })
}

function countPartsAheadInMemory(
  dueParts: Array<{ id: string; scheduledAt: Date | null }>,
  target: { id: string; scheduledAt: Date | null }
): number {
  if (!target.scheduledAt) return 0
  const targetTime = target.scheduledAt.getTime()
  let ahead = 0
  for (const part of dueParts) {
    if (part.id === target.id || part.scheduledAt == null) continue
    if (part.scheduledAt.getTime() < targetTime) ahead += 1
  }
  return ahead
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

  // Carregada preguiçosamente UMA vez, e só se algum item cair em
  // daily_cap_reached — os demais motivos não usam posição de fila.
  let dueParts: Array<{ id: string; scheduledAt: Date | null }> | null = null

  for (const campaign of params.campaigns) {
    const additionalRecipients =
      campaign.exactAdditionalRecipients != null
        ? campaign.exactAdditionalRecipients
        : campaign.retryFailedOnly
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
      dueParts ??= await listDueScheduledParts({ teamId: params.teamId, now: params.now })
      const queuedAheadCount = countPartsAheadInMemory(dueParts, campaign)
      result.set(campaign.id, { ...availability, queuedAheadCount })
      continue
    }

    result.set(campaign.id, availability)
  }

  return result
}
