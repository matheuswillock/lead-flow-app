import { formatLocalDateValue, getMinutesInTz } from "@/lib/dates"

export type DispatchBlockedDateEntry = { date?: string; from?: string; to?: string }

/**
 * O gate tem DUAS causas independentes, e a mensagem precisa dizer qual delas
 * travou. Uma copy única mandava "habilite as métricas" mesmo quando o bloqueio
 * real era o DNS — e aí ligar a abertura não destravava nada, porque
 * `isResendDomainTrackingCapable` exige `verified`. O usuário ficava girando no
 * botão errado.
 */
export const RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE =
  "O DNS de envio do seu domínio ainda não está verificado no Resend. Nenhum disparo será liberado enquanto os registros DKIM e SPF não aparecerem como verificados. Publique os registros pendentes e use \"Verificar DNS\"."

export const RESEND_DOMAIN_METRICS_DISABLED_MESSAGE =
  "Suas campanhas disparam normalmente, mas sem taxa de abertura. Para recuperar a métrica, publique o CNAME de tracking e habilite a abertura em Métricas de tracking. O rastreio de cliques permanece desligado de propósito: ele reescreve os links do e-mail e faz provedores marcarem a mensagem como suspeita — os cliques já são medidos no próprio formulário."

/** @deprecated Prefira as duas mensagens específicas — esta não diz qual causa travou. */
export const RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE = RESEND_DOMAIN_METRICS_DISABLED_MESSAGE

/** @deprecated Use RESEND_DOMAIN_METRICS_DISABLED_MESSAGE. */
export const RESEND_DOMAIN_TRACKING_DEGRADED_WARNING = RESEND_DOMAIN_METRICS_DISABLED_MESSAGE

export type ResendDomainTrackingInput = {
  domainName?: string | null
  domainStatus?: string | null
  openTracking?: boolean | null
  clickTracking?: boolean | null
  /** DKIM e SPF verificados, ignorando o CNAME de tracking. */
  sendingDnsVerified?: boolean | null
}

export type ResendDomainTrackingCheck =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Statuses that allow campaign dispatch with a custom Resend domain.
 * `partially_verified` / `partially_failed` mean sending DNS (DKIM/SPF) is ok
 * while tracking may be pending or degraded — Resend still accepts sends.
 * Campaign dispatch additionally requires `assertResendDomainTrackingReady`.
 */
export function isResendDomainSendCapable(status: string | null | undefined): boolean {
  return (
    status === "verified" ||
    status === "partially_verified" ||
    status === "partially_failed"
  )
}

/** Full tracking (open/click) only when every DNS record including CNAME is verified. */
export function isResendDomainTrackingCapable(status: string | null | undefined): boolean {
  return status === "verified"
}

export function resendDomainTrackingInputFromSettings(settings: {
  resendDomainName?: string | null
  resendDomainStatus?: string | null
  resendOpenTracking?: boolean | null
  resendClickTracking?: boolean | null
  resendSendingDnsVerified?: boolean | null
} | null | undefined): ResendDomainTrackingInput {
  return {
    domainName: settings?.resendDomainName,
    domainStatus: settings?.resendDomainStatus,
    openTracking: settings?.resendOpenTracking,
    clickTracking: settings?.resendClickTracking,
    sendingDnsVerified: settings?.resendSendingDnsVerified,
  }
}

/**
 * O DNS de envio está ok?
 *
 * `resendSendingDnsVerified` é derivado registro a registro em
 * `syncFromResendDomain` e é a fonte precisa. O fallback por `verified` existe
 * para a transição: a coluna nasce `false` para todo mundo e só é populada
 * quando o cron de 6h roda ou alguém clica "Verificar DNS". Sem ele, subir esta
 * mudança bloquearia na hora todos os times que hoje disparam normalmente.
 *
 * Domínio `verified` tem, por definição, DKIM e SPF verificados — então tratar
 * como equivalente não afrouxa nada.
 */
export function hasSendingDnsReady(params: ResendDomainTrackingInput): boolean {
  if (params.sendingDnsVerified) return true
  return isResendDomainTrackingCapable(params.domainStatus)
}

/**
 * Domínio próprio só dispara com o DNS de ENVIO verificado. Time sem domínio
 * próprio não é gateado.
 *
 * O gate protege a capacidade de entregar, não a de medir. Antes ele exigia
 * `status === "verified"` estrito, e um CNAME de tracking pendente — que só
 * alimenta o pixel de abertura — derrubava o domínio inteiro para
 * `partially_failed` e travava todo disparo, indefinidamente e sem saída pela
 * UI. Foi o que aconteceu com um time real cujo DKIM e SPF estavam íntegros
 * desde a criação do domínio.
 *
 * Métrica desligada virou aviso não-bloqueante em
 * `getResendDomainDispatchWarnings`: perder taxa de abertura é recuperável a
 * qualquer momento; não conseguir enviar, não.
 */
export function assertResendDomainTrackingReady(
  params: ResendDomainTrackingInput
): ResendDomainTrackingCheck {
  if (!params.domainName?.trim()) return { ok: true }

  if (!hasSendingDnsReady(params)) {
    return { ok: false, message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE }
  }

  return { ok: true }
}

/**
 * Avisos da tela de campanhas. Inclui tanto o que BLOQUEIA (DNS de envio) quanto
 * o que apenas DEGRADA (sem métrica de abertura) — quem consome distingue pelo
 * `assertResendDomainTrackingReady`, não por esta lista.
 */
export function getResendDomainDispatchWarnings(params: ResendDomainTrackingInput): string[] {
  const blocked = assertResendDomainTrackingReady(params)
  if (!blocked.ok) return [blocked.message]
  if (!params.domainName?.trim()) return []

  // Duas causas para não medir abertura: métrica desligada, ou CNAME de
  // tracking pendente. As duas produzem o mesmo efeito e a mesma orientação.
  const metricsEnabled = Boolean(params.openTracking || params.clickTracking)
  const canMeasure = isResendDomainTrackingCapable(params.domainStatus)
  if (!metricsEnabled || !canMeasure) {
    return [RESEND_DOMAIN_METRICS_DISABLED_MESSAGE]
  }

  return []
}

export type DispatchWindowCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string; defer: boolean }

/** Verifica datas bloqueadas e janela de horário no fuso do master. */
export function checkDispatchWindow(
  now: Date,
  timezone: string,
  options: {
    dispatchBlockedDates?: DispatchBlockedDateEntry[] | null
    dispatchTimeFrom?: string | null
    dispatchTimeTo?: string | null
  }
): DispatchWindowCheckResult {
  const todayStr = formatLocalDateValue(now, timezone)
  const blockedDates = options.dispatchBlockedDates ?? []

  for (const entry of blockedDates) {
    if (entry.date && entry.date === todayStr) {
      return {
        blocked: true,
        defer: true,
        reason: `Data ${todayStr} bloqueada por restrição configurada`,
      }
    }
    if (entry.from && entry.to && todayStr >= entry.from && todayStr <= entry.to) {
      return {
        blocked: true,
        defer: true,
        reason: `Período bloqueado ${entry.from} – ${entry.to}`,
      }
    }
  }

  const { dispatchTimeFrom, dispatchTimeTo } = options
  if (dispatchTimeFrom && dispatchTimeTo) {
    const currentMinutes = getMinutesInTz(now, timezone)
    const [fH, fM] = dispatchTimeFrom.split(":").map(Number)
    const [tH, tM] = dispatchTimeTo.split(":").map(Number)
    const fromMinutes = fH * 60 + fM
    const toMinutes = tH * 60 + tM
    if (currentMinutes < fromMinutes || currentMinutes > toMinutes) {
      return {
        blocked: true,
        defer: true,
        reason: `Fora da janela de disparo ${dispatchTimeFrom}–${dispatchTimeTo} (${timezone})`,
      }
    }
  }

  return { blocked: false }
}

/**
 * `partially_sent` significa "sobrou alguém que vale retentar" — não "a conta
 * não fechou".
 *
 * A regra antiga comparava `sentCount` com `totalRecipients` e marcava
 * `partially_sent` em qualquer diferença. Isso é frágil porque `totalRecipients`
 * é a contagem da audiência no momento em que o disparo nasce, e nem todo
 * destinatário chega a virar `EmailLog`: a materialização ainda descarta
 * endereços por pré-validação e blocklist. Caso real (Homens v2 1/4,
 * 22/08/2026): 1998 na audiência, 1969 logs criados, 1782 enviados, 187
 * suprimidos — os 29 restantes sumiram antes de existir log, e a campanha ficava
 * eternamente `partially_sent` oferecendo reenvio de gente que não existe.
 *
 * `failedCount` (logs `failed`) é o critério direto: são as recusas do provedor
 * — rate limit, cota, erro transitório — as únicas que um reenvio pode resolver.
 * Já `suppressed` vem da nossa pré-validação (typo de domínio, provedor morto,
 * endereço genérico, bounce anterior) e reprovaria de novo na mesma regra
 * determinística; e bounce posterior à entrega já contou como enviado, porque
 * `countSuccessfulDispatchLogs` usa `sentAt != null`.
 *
 * `totalRecipients` continua na assinatura por compatibilidade com os
 * chamadores, mas não decide mais o status.
 */
export function resolveCampaignStatusAfterDispatch(
  sentCount: number,
  failureDetail?: string | null,
  totalRecipients?: number,
  failedCount = 0
): {
  campaignStatus: "sent" | "failed" | "partially_sent"
  dispatchStatus: "completed" | "failed"
  errorMessage: string | null
} {
  if (sentCount <= 0) {
    return {
      campaignStatus: "failed",
      dispatchStatus: "failed",
      errorMessage: failureDetail?.trim() || "Nenhum e-mail foi enviado pelo provedor",
    }
  }

  if (failedCount > 0) {
    return {
      campaignStatus: "partially_sent",
      dispatchStatus: "completed",
      errorMessage: failureDetail?.trim() || null,
    }
  }

  return { campaignStatus: "sent", dispatchStatus: "completed", errorMessage: null }
}

/**
 * Mesma regra da função acima, aplicada na releitura da lista a partir dos
 * contadores cumulativos de log. Vive aqui, ao lado da irmã, porque foi
 * justamente a divergência entre as duas que causou o bug: o disparo persistia
 * `sent`, o reconciler recalculava por outro critério e regravava
 * `partially_sent`, devolvendo o botão de reenviar falhas sozinho.
 *
 * NÃO recebe `totalRecipients` de propósito. Comparar contagem de log com o
 * total da audiência parece razoável e não é: destinatários podem ser
 * descartados na materialização e nunca virar log — no caso real da Homens v2,
 * 1782 aceitos + 187 suprimidos = 1969, contra `totalRecipients` 1998. Os 29 de
 * diferença deixariam a campanha presa em `partially_sent` para sempre.
 *
 * Disparo interrompido no meio da materialização é problema do finalizador, que
 * compara `materializedLogCount` com o total do dispatch e republica o wake —
 * ver `recoverStuckSendingCampaigns` e `resumeOrphanSendingDispatches`. Aqui só
 * há log, e log não distingue "nunca materializou" de "audiência encolheu".
 */
export function resolveReconciledCampaignStatus(counters: {
  acceptedCount: number
  failedCount: number
  queuedCount: number
  suppressedCount: number
}): "sent" | "failed" | "partially_sent" {
  if (counters.acceptedCount === 0) return "failed"
  // Só o que ainda pode sair segura a campanha: falha é retentável, fila é
  // transitória. Recusado na pré-validação é terminal e fecha.
  if (counters.failedCount > 0 || counters.queuedCount > 0) return "partially_sent"
  return "sent"
}
