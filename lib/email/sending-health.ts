/**
 * Trava de reputação por time (estilo Mailchimp) — máquina de estados PURA.
 *
 * O motor de supressão só aprende DEPOIS do bounce; esta trava existe para
 * parar o sangramento em minutos (incidente 01–15/09: ~10,6 mil bounces de
 * listas importadas queimaram o domínio no Gmail). O cron
 * `evaluate-sending-health` calcula janelas móveis 7d/30d sobre
 * EmailLog/EmailEvent e aplica as transições daqui; enforcement em
 * `EmailCampaignUseCase` (criar/agendar bloqueado, partes agendadas adiadas,
 * abort mid-send).
 *
 * Semântica de bounce: só **hard bounce** (`bounceType === "Permanent"`,
 * mesma regra de `lib/email/bounce-suppression.ts`) conta para as taxas.
 */

export type EmailSendingHealthStatusValue = "healthy" | "warned" | "paused" | "suspended"

/** Volume mínimo na janela de 7d para as taxas terem significância. */
export const SENDING_HEALTH_MIN_SENDS_7D = 200

/** warned quando bounce 7d ≥ 2% OU complaint 7d ≥ 0,1%. */
export const SENDING_HEALTH_WARN_HARD_BOUNCE_RATE = 0.02
export const SENDING_HEALTH_WARN_COMPLAINT_RATE = 0.001

/** paused quando bounce 7d ≥ 5% OU complaint 7d ≥ 0,3%. */
export const SENDING_HEALTH_PAUSE_HARD_BOUNCE_RATE = 0.05
export const SENDING_HEALTH_PAUSE_COMPLAINT_RATE = 0.003

/** warned→healthy automático após 14 dias contínuos abaixo do warn. */
export const SENDING_HEALTH_RECOVERY_DAYS = 14

/** 2ª pausa dentro de 30 dias = suspended (só backoffice libera). */
export const SENDING_HEALTH_SUSPEND_PAUSE_COUNT = 2
export const SENDING_HEALTH_SUSPEND_WINDOW_DAYS = 30

/** Abort mid-send: a própria parte com bounce ≥ 8% e ≥ 100 enviados. */
export const SENDING_HEALTH_ABORT_MIN_SENT = 100
export const SENDING_HEALTH_ABORT_HARD_BOUNCE_RATE = 0.08

const DAY_MS = 24 * 60 * 60 * 1000

export type SendingHealthWindowMetrics = {
  sent7d: number
  hardBounced7d: number
  complained7d: number
  sent30d: number
  hardBounced30d: number
  complained30d: number
}

export type SendingHealthRates = {
  hardBounceRate7d: number
  complaintRate7d: number
  /** false = abaixo de SENDING_HEALTH_MIN_SENDS_7D; taxas não escalam status. */
  hasMinimumVolume: boolean
}

export function computeSendingHealthRates(metrics: SendingHealthWindowMetrics): SendingHealthRates {
  const sent = Math.max(0, metrics.sent7d)
  return {
    hardBounceRate7d: sent > 0 ? metrics.hardBounced7d / sent : 0,
    complaintRate7d: sent > 0 ? metrics.complained7d / sent : 0,
    hasMinimumVolume: sent >= SENDING_HEALTH_MIN_SENDS_7D,
  }
}

export type SendingHealthSeverity = "ok" | "warn" | "pause"

/**
 * Sem volume mínimo a severidade é sempre `ok`: 3 bounces em 20 envios não
 * são sinal, são ruído. A recuperação usa o mesmo critério — time warned que
 * parou de enviar fica "abaixo do warn" e recupera após 14 dias.
 */
export function classifySendingHealthSeverity(rates: SendingHealthRates): SendingHealthSeverity {
  if (!rates.hasMinimumVolume) return "ok"
  if (
    rates.hardBounceRate7d >= SENDING_HEALTH_PAUSE_HARD_BOUNCE_RATE ||
    rates.complaintRate7d >= SENDING_HEALTH_PAUSE_COMPLAINT_RATE
  ) {
    return "pause"
  }
  if (
    rates.hardBounceRate7d >= SENDING_HEALTH_WARN_HARD_BOUNCE_RATE ||
    rates.complaintRate7d >= SENDING_HEALTH_WARN_COMPLAINT_RATE
  ) {
    return "warn"
  }
  return "ok"
}

/** Shape persistido em `EmailTeamSettings.sendingHealthMetrics` (Json). */
export type SendingHealthSnapshot = {
  computedAt: string
  windows: SendingHealthWindowMetrics
  rates: SendingHealthRates
  /** Início do período contínuo abaixo do warn (só relevante em `warned`). */
  belowWarnSince: string | null
  /** ISO das entradas em `paused` — base do gatilho de suspensão (30d). */
  pauseHistory: string[]
}

function parseSendingHealthWindows(value: unknown): SendingHealthWindowMetrics {
  const zeroWindows: SendingHealthWindowMetrics = {
    sent7d: 0,
    hardBounced7d: 0,
    complained7d: 0,
    sent30d: 0,
    hardBounced30d: 0,
    complained30d: 0,
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return zeroWindows
  const windows = (value as Record<string, unknown>).windows
  if (!windows || typeof windows !== "object" || Array.isArray(windows)) return zeroWindows
  const source = windows as Record<string, unknown>
  const readCount = (key: keyof SendingHealthWindowMetrics): number => {
    const count = source[key]
    return typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : 0
  }
  return {
    sent7d: readCount("sent7d"),
    hardBounced7d: readCount("hardBounced7d"),
    complained7d: readCount("complained7d"),
    sent30d: readCount("sent30d"),
    hardBounced30d: readCount("hardBounced30d"),
    complained30d: readCount("complained30d"),
  }
}

export function parseSendingHealthSnapshot(value: unknown): {
  belowWarnSince: Date | null
  pauseHistory: Date[]
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { belowWarnSince: null, pauseHistory: [] }
  }
  const source = value as Record<string, unknown>

  const belowWarnRaw = source.belowWarnSince
  const belowWarnSince =
    typeof belowWarnRaw === "string" && !Number.isNaN(Date.parse(belowWarnRaw))
      ? new Date(belowWarnRaw)
      : null

  const historyRaw = source.pauseHistory
  const pauseHistory = Array.isArray(historyRaw)
    ? historyRaw
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => !Number.isNaN(Date.parse(entry)))
        .map((entry) => new Date(entry))
    : []

  return { belowWarnSince, pauseHistory }
}

function pruneToSuspendWindow(pauseHistory: Date[], now: Date): Date[] {
  const windowStart = now.getTime() - SENDING_HEALTH_SUSPEND_WINDOW_DAYS * DAY_MS
  return pauseHistory.filter((pausedAt) => pausedAt.getTime() >= windowStart)
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
}

export function buildSendingHealthWarnReason(rates: SendingHealthRates): string {
  return `Taxas acima do limiar de alerta na janela de 7 dias: bounce ${formatPercent(rates.hardBounceRate7d)} (limiar ${formatPercent(SENDING_HEALTH_WARN_HARD_BOUNCE_RATE)}) · reclamações ${formatPercent(rates.complaintRate7d)} (limiar ${formatPercent(SENDING_HEALTH_WARN_COMPLAINT_RATE)}).`
}

export function buildSendingHealthPauseReason(rates: SendingHealthRates): string {
  return `Envio pausado automaticamente: bounce ${formatPercent(rates.hardBounceRate7d)} (limiar ${formatPercent(SENDING_HEALTH_PAUSE_HARD_BOUNCE_RATE)}) · reclamações ${formatPercent(rates.complaintRate7d)} (limiar ${formatPercent(SENDING_HEALTH_PAUSE_COMPLAINT_RATE)}) na janela de 7 dias.`
}

export function buildSendingHealthSuspendReason(pauseCount: number): string {
  return `Envio suspenso: ${pauseCount} pausas por reputação em ${SENDING_HEALTH_SUSPEND_WINDOW_DAYS} dias. Liberação somente pelo Corretor Studio.`
}

export function buildSendingHealthRecoveryReason(): string {
  return `Taxas abaixo do limiar de alerta por ${SENDING_HEALTH_RECOVERY_DAYS} dias contínuos.`
}

export function buildSendingHealthAbortPauseReason(params: {
  dispatchLabel: string
  hardBounceRate: number
  sentCount: number
}): string {
  return `Envio pausado automaticamente: disparo ${params.dispatchLabel} abortado por taxa de bounce (${formatPercent(params.hardBounceRate)} com ${params.sentCount.toLocaleString("pt-BR")} enviados).`
}

export type SendingHealthTransitionInput = {
  current: EmailSendingHealthStatusValue
  rates: SendingHealthRates
  now: Date
  belowWarnSince: Date | null
  pauseHistory: Date[]
}

export type SendingHealthTransitionResult = {
  next: EmailSendingHealthStatusValue
  changed: boolean
  reason: string | null
  belowWarnSince: Date | null
  pauseHistory: Date[]
}

/**
 * Transições AUTOMÁTICAS, com histerese:
 * - healthy → warned/paused/suspended pelos limiares;
 * - warned → healthy só após 14 dias contínuos abaixo do warn;
 * - entrada em paused registra no histórico; 2ª pausa em 30 dias vira
 *   suspended direto;
 * - paused e suspended NUNCA saem automaticamente (liberação manual:
 *   owner/backoffice para paused, só backoffice para suspended).
 */
export function resolveSendingHealthTransition(
  input: SendingHealthTransitionInput
): SendingHealthTransitionResult {
  const prunedHistory = pruneToSuspendWindow(input.pauseHistory, input.now)
  const severity = classifySendingHealthSeverity(input.rates)

  if (input.current === "paused" || input.current === "suspended") {
    return {
      next: input.current,
      changed: false,
      reason: null,
      belowWarnSince: null,
      pauseHistory: prunedHistory,
    }
  }

  if (severity === "pause") {
    const nextHistory = [...prunedHistory, input.now]
    if (nextHistory.length >= SENDING_HEALTH_SUSPEND_PAUSE_COUNT) {
      return {
        next: "suspended",
        changed: true,
        reason: buildSendingHealthSuspendReason(nextHistory.length),
        belowWarnSince: null,
        pauseHistory: nextHistory,
      }
    }
    return {
      next: "paused",
      changed: true,
      reason: buildSendingHealthPauseReason(input.rates),
      belowWarnSince: null,
      pauseHistory: nextHistory,
    }
  }

  if (severity === "warn") {
    if (input.current === "warned") {
      // Continua acima do warn: zera a contagem de recuperação.
      return {
        next: "warned",
        changed: false,
        reason: null,
        belowWarnSince: null,
        pauseHistory: prunedHistory,
      }
    }
    return {
      next: "warned",
      changed: true,
      reason: buildSendingHealthWarnReason(input.rates),
      belowWarnSince: null,
      pauseHistory: prunedHistory,
    }
  }

  // severity === "ok"
  if (input.current === "warned") {
    const since = input.belowWarnSince ?? input.now
    const recovered =
      input.now.getTime() - since.getTime() >= SENDING_HEALTH_RECOVERY_DAYS * DAY_MS
    if (recovered) {
      return {
        next: "healthy",
        changed: true,
        reason: buildSendingHealthRecoveryReason(),
        belowWarnSince: null,
        pauseHistory: prunedHistory,
      }
    }
    return {
      next: "warned",
      changed: false,
      reason: null,
      belowWarnSince: since,
      pauseHistory: prunedHistory,
    }
  }

  return {
    next: "healthy",
    changed: false,
    reason: null,
    belowWarnSince: null,
    pauseHistory: prunedHistory,
  }
}

export type SendingHealthReleaseActor = "team_owner" | "backoffice"

export type SendingHealthReleaseResult =
  | { ok: true; next: EmailSendingHealthStatusValue; reason: string }
  | { ok: false; message: string }

/**
 * Liberação MANUAL: paused → warned (owner do time ou backoffice);
 * suspended → warned (somente backoffice). Volta para `warned`, nunca direto
 * para `healthy` — a recuperação plena continua exigindo 14 dias limpos.
 */
export function resolveManualSendingHealthRelease(params: {
  current: EmailSendingHealthStatusValue
  actor: SendingHealthReleaseActor
}): SendingHealthReleaseResult {
  if (params.current === "paused") {
    return {
      ok: true,
      next: "warned",
      reason:
        params.actor === "backoffice"
          ? "Pausa liberada pelo Corretor Studio."
          : "Pausa liberada pelo responsável do time.",
    }
  }
  if (params.current === "suspended") {
    if (params.actor !== "backoffice") {
      return {
        ok: false,
        message: "Envio suspenso: somente o Corretor Studio pode liberar.",
      }
    }
    return { ok: true, next: "warned", reason: "Suspensão liberada pelo Corretor Studio." }
  }
  return { ok: false, message: "O envio deste time não está pausado nem suspenso." }
}

/** true quando a trava impede criar/agendar/disparar campanhas. */
export function isSendingHealthBlocked(
  status: EmailSendingHealthStatusValue | null | undefined
): boolean {
  return status === "paused" || status === "suspended"
}

export function formatSendingHealthBlockMessage(params: {
  status: EmailSendingHealthStatusValue
  reason?: string | null
}): string {
  const releaseHint =
    params.status === "suspended"
      ? "Fale com o suporte do Corretor Studio para liberar."
      : "Higienize suas listas e libere o envio em Configurações de e-mail, ou fale com o suporte."
  const reasonPart = params.reason?.trim() ? ` Motivo: ${params.reason.trim()}` : ""
  const statusLabel = params.status === "suspended" ? "suspenso" : "pausado"
  return `O envio de campanhas deste time está ${statusLabel} pela trava de reputação.${reasonPart} ${releaseHint}`
}

/** Gatilho do abort mid-send de UMA parte (dispatch). */
export function shouldAbortDispatchForBounceSpike(params: {
  sentCount: number
  hardBouncedCount: number
}): boolean {
  if (params.sentCount < SENDING_HEALTH_ABORT_MIN_SENT) return false
  return (
    params.hardBouncedCount / params.sentCount >= SENDING_HEALTH_ABORT_HARD_BOUNCE_RATE
  )
}

/** errorMessage da PARTE abortada (dispatch + campanha). */
export function formatDispatchBounceAbortMessage(params: {
  hardBounceRate: number
  sentCount: number
  hardBouncedCount: number
}): string {
  return `Disparo abortado por taxa de bounce: ${formatPercent(params.hardBounceRate)} de bounce permanente (${params.hardBouncedCount.toLocaleString("pt-BR")} de ${params.sentCount.toLocaleString("pt-BR")} enviados; limiar ${formatPercent(SENDING_HEALTH_ABORT_HARD_BOUNCE_RATE)} com ≥${SENDING_HEALTH_ABORT_MIN_SENT}). O restante da parte não foi enviado e o envio do time foi pausado até liberação manual.`
}

/**
 * Snapshot para uma pausa fora do cron (abort mid-send ou pausa forçada pelo
 * backoffice): preserva janelas/histórico persistidos, registra a pausa e
 * devolve a contagem para o gatilho de suspensão (2 pausas em 30 dias).
 */
export function buildPauseSnapshotFromExisting(
  metricsJson: unknown,
  now: Date
): { snapshot: SendingHealthSnapshot; pauseCount: number } {
  const windows = parseSendingHealthWindows(metricsJson)
  const rates = computeSendingHealthRates(windows)
  const { pauseHistory } = parseSendingHealthSnapshot(metricsJson)
  const nextHistory = [...pruneToSuspendWindow(pauseHistory, now), now]
  return {
    snapshot: buildSendingHealthSnapshot({
      now,
      windows,
      rates,
      belowWarnSince: null,
      pauseHistory: nextHistory,
    }),
    pauseCount: nextHistory.length,
  }
}

export function buildSendingHealthSnapshot(params: {
  now: Date
  windows: SendingHealthWindowMetrics
  rates: SendingHealthRates
  belowWarnSince: Date | null
  pauseHistory: Date[]
}): SendingHealthSnapshot {
  return {
    computedAt: params.now.toISOString(),
    windows: params.windows,
    rates: params.rates,
    belowWarnSince: params.belowWarnSince ? params.belowWarnSince.toISOString() : null,
    pauseHistory: params.pauseHistory.map((pausedAt) => pausedAt.toISOString()),
  }
}
