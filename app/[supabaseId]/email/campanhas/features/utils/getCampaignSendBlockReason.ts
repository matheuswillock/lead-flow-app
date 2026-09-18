import type { CreditStatus, DispatchAvailability } from "../context/CampanhasTypes"
import { formatDailyLimitDispatchBlockMessage } from "@/lib/email/campaign-limits"
import { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } from "@/lib/email/campaign-dispatch-guards"

type CampaignRecipientTarget = {
  totalRecipients: number
  dispatchAvailability?: DispatchAvailability | null
}

/**
 * Duplicação deliberada e documentada: a mesma frase vive em
 * `EMAIL_CAMPAIGN_FAILURE_MESSAGES.MONTHLY_QUOTA_ACTIVE`
 * (`app/api/useCases/email/EmailCampaignUseCase.ts`), um arquivo server-only
 * (Prisma, Sentry) que não pode ser importado pelo bundle do cliente. Mudar
 * uma cópia sem mudar a outra dessincroniza o toast do texto do tooltip —
 * mesma fragilidade já registrada na SPEC 20 (open question 2) para o
 * registro do incidente de cota.
 */
const MONTHLY_QUOTA_ACTIVE_TOOLTIP_MESSAGE =
  "Cota mensal de envio do provedor esgotada neste mês. Nenhum e-mail foi enfileirado. O envio volta a funcionar na virada do mês."

/**
 * Traduz o `dispatchAvailability` calculado pelo backend (mesma lógica do
 * cron `dispatchScheduledCampaigns` e do disparo manual
 * `startManualDispatch` — nunca recalculada aqui) em texto de tooltip.
 *
 * A copy do teto diário NUNCA promete que a saída é exatamente à meia-noite:
 * caso de starvation em cascata medido em produção (time Rafael, 10/09) — a
 * parte represada de ontem consome o teto assim que ele libera, empurrando
 * partes mais novas para o próximo dia. `queuedAheadCount` (quando presente)
 * declara a fila real em vez de um horário que pode não se cumprir.
 */
function resolveDispatchAvailabilityBlockReason(
  availability: DispatchAvailability | null | undefined
): string | undefined {
  if (!availability || availability.canDispatchNow) return undefined

  switch (availability.reason) {
    case "dispatch_in_progress":
      return "Disparo em andamento. Aguarde a conclusão para disparar de novo."
    case "already_sent":
      return "Parte já enviada. Disparar de novo reenviaria a TODOS os destinatários novamente."
    case "monthly_quota_active":
      return MONTHLY_QUOTA_ACTIVE_TOOLTIP_MESSAGE
    case "daily_cap_reached": {
      if (availability.dailyCap == null) return undefined
      const used = availability.sentToday.toLocaleString("pt-BR")
      const cap = availability.dailyCap.toLocaleString("pt-BR")
      const queueSuffix =
        availability.queuedAheadCount != null && availability.queuedAheadCount > 0
          ? ` Há ${availability.queuedAheadCount} parte(s) agendada(s) antes desta.`
          : ""
      return `Teto diário atingido (${used}/${cap} hoje). Libera à meia-noite; envios seguem a ordem de agendamento.${queueSuffix}`
    }
    default:
      return undefined
  }
}

function resolveDailyDispatchBlockReason(
  campaign: CampaignRecipientTarget,
  credits: CreditStatus | null
): string | undefined {
  const dailyDispatch = credits?.dailyDispatch
  if (
    dailyDispatch &&
    !dailyDispatch.isUnlimited &&
    dailyDispatch.limit != null &&
    dailyDispatch.remaining != null &&
    dailyDispatch.remaining < campaign.totalRecipients
  ) {
    return formatDailyLimitDispatchBlockMessage(dailyDispatch.limit, dailyDispatch.remaining)
  }

  return undefined
}

export function getCampaignSendBlockReason(params: {
  campaign: CampaignRecipientTarget
  credits: CreditStatus | null
  /** Runtime host bypass (ex.: backoffice/studio). Never derive from showsBetaLabel. */
  bypassPlanGate?: boolean
}): string | undefined {
  const { campaign, credits, bypassPlanGate = false } = params

  // Prioridade máxima: verdade estrutural do backend (mesmo cálculo do cron e
  // do disparo manual). "Parte já enviada" e "disparo em andamento" bloqueiam
  // mesmo que os checks de plano/crédito abaixo liberariam — evita o
  // re-disparo acidental de uma parte já concluída.
  const availabilityBlockReason = resolveDispatchAvailabilityBlockReason(
    campaign.dispatchAvailability
  )
  if (availabilityBlockReason) return availabilityBlockReason

  // Trava de reputação: decidida no servidor (mesma fonte dos guards de
  // create/disparo). Vem antes do gate de tracking — pausa de reputação não é
  // problema de DNS e a orientação é outra (higienizar listas/liberar envio).
  if (credits?.sendingHealthBlocked) {
    return (
      credits.sendingHealthBlockReason ??
      "O envio de campanhas deste time está pausado pela trava de reputação."
    )
  }

  if (credits?.trackingDispatchBlocked) {
    return credits.trackingDispatchBlockReason ?? RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE
  }

  const dailyBlockReason = resolveDailyDispatchBlockReason(campaign, credits)
  if (dailyBlockReason) return dailyBlockReason

  // Plan/credit exemption must match backend resolveEmailBetaAccess via credits.isBetaExempt.
  if (bypassPlanGate || credits?.isBetaExempt) return undefined
  if (!credits?.hasSubscription) {
    return "Ative um plano em Assinaturas para disparar campanhas"
  }
  if (credits.creditsAvailable < campaign.totalRecipients) {
    return `Créditos insuficientes para ${campaign.totalRecipients.toLocaleString("pt-BR")} destinatários. Saldo: ${credits.creditsAvailable.toLocaleString("pt-BR")}`
  }

  return undefined
}
