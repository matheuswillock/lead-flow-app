export const EMAIL_WARMUP_LIMITS = [100, 250, 500, 1000, 2000] as const
export const EMAIL_WARMUP_ADVANCE_USAGE_RATIO = 0.8
export const EMAIL_WARMUP_INACTIVITY_DAYS = 30
export const EMAIL_WARMUP_HISTORY_DAYS = 7
export const EMAIL_WARMUP_MINIMUM_ELIGIBLE_DAYS = 3
export const EMAIL_WARMUP_MAX_COMPLAINT_RATE = 0.001
export const EMAIL_WARMUP_MAX_HARD_BOUNCE_RATE = 0.02
export const EMAIL_WARMUP_MAX_TOTAL_BOUNCE_RATE = 0.05

export type EmailDomainTemperature = "warming" | "stable"
export type EmailDomainHealth = "healthy" | "attention" | "paused"
export type EmailWarmupStatus = "warming" | "established" | "paused"

export type EmailWarmupSnapshot = {
  stage: number
  limit: number
  used: number
  reserved?: number
  health: EmailDomainHealth
  lastActivityAt: Date | null
  isSharedPlatformDomain?: boolean
}

export type EmailWarmupState = EmailWarmupSnapshot & {
  status: EmailWarmupStatus
  temperature: EmailDomainTemperature
  remaining: number
  usageRatio: number
  shouldAdvance: boolean
  reason: string | null
  nextEvaluationAt: Date
}

export type EmailWarmupHistoryDay = {
  capacity: number
  sent: number
  delivered: number
  hardBounced: number
  softBounced: number
  complained: number
}

export type EmailWarmupProgressionDecision = {
  stage: number
  action: "advance" | "regress" | "pause" | "hold"
  reason: string
}

function clampStage(stage: number): number {
  return Math.min(Math.max(Math.trunc(stage), 0), EMAIL_WARMUP_LIMITS.length - 1)
}

function hasBeenInactive(lastActivityAt: Date | null, now: Date): boolean {
  if (!lastActivityAt) return false
  const elapsedDays = (now.getTime() - lastActivityAt.getTime()) / 86_400_000
  return elapsedDays >= EMAIL_WARMUP_INACTIVITY_DAYS
}

export function resolveEmailWarmupState(
  snapshot: EmailWarmupSnapshot,
  now = new Date()
): EmailWarmupState {
  if (snapshot.isSharedPlatformDomain) {
    return {
      ...snapshot,
      stage: EMAIL_WARMUP_LIMITS.length - 1,
      limit: Number.MAX_SAFE_INTEGER,
      used: snapshot.used,
      status: "established",
      temperature: "stable",
      remaining: Number.MAX_SAFE_INTEGER,
      usageRatio: 0,
      shouldAdvance: false,
      reason: null,
      reserved: snapshot.reserved ?? 0,
      nextEvaluationAt: nextUtcDay(now),
    }
  }

  const currentStage = clampStage(snapshot.stage)
  const stage = hasBeenInactive(snapshot.lastActivityAt, now)
    ? Math.max(0, currentStage - 1)
    : currentStage
  const limit = EMAIL_WARMUP_LIMITS[stage]
  const used = Math.max(0, snapshot.used)
  const usageRatio = used / limit
  const isPaused = snapshot.health === "paused"
  const isEstablished = stage === EMAIL_WARMUP_LIMITS.length - 1 && !isPaused

  return {
    ...snapshot,
    stage,
    limit,
    used,
    status: isPaused ? "paused" : isEstablished ? "established" : "warming",
    temperature: isEstablished ? "stable" : "warming",
    remaining: Math.max(0, limit - used),
    usageRatio,
    shouldAdvance:
      !isPaused && stage < EMAIL_WARMUP_LIMITS.length - 1 && usageRatio >= EMAIL_WARMUP_ADVANCE_USAGE_RATIO,
    reason: isPaused ? "A saúde do domínio precisa melhorar antes de aumentar o volume." : null,
    reserved: snapshot.reserved ?? 0,
    nextEvaluationAt: nextUtcDay(now),
  }
}

function nextUtcDay(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  ))
}

export function evaluateEmailWarmupProgression(
  input: {
    stage: number
    health: EmailDomainHealth
    lastActivityAt: Date | null
    days: EmailWarmupHistoryDay[]
  },
  now = new Date()
): EmailWarmupProgressionDecision {
  const stage = clampStage(input.stage)
  if (input.health === "paused") {
    return {
      stage,
      action: "pause",
      reason: "A saúde do domínio está crítica e novas reservas foram pausadas.",
    }
  }
  if (hasBeenInactive(input.lastActivityAt, now)) {
    return {
      stage: Math.max(0, stage - 1),
      action: "regress",
      reason: "O domínio ficou 30 dias sem atividade e recuou um estágio.",
    }
  }
  if (input.health === "attention") {
    return {
      stage,
      action: "hold",
      reason: "A saúde do domínio precisa melhorar antes de aumentar o volume.",
    }
  }

  const eligibleDays = input.days.slice(-EMAIL_WARMUP_HISTORY_DAYS).filter(isEligibleWarmupDay)
  if (eligibleDays.length < EMAIL_WARMUP_MINIMUM_ELIGIBLE_DAYS) {
    return {
      stage,
      action: "hold",
      reason: "São necessários três dias elegíveis na janela de sete dias para avançar.",
    }
  }

  const nextStage = Math.min(stage + 1, EMAIL_WARMUP_LIMITS.length - 1)
  return {
    stage: nextStage,
    action: nextStage === stage ? "hold" : "advance",
    reason:
      nextStage === stage
        ? "O domínio já está no estágio máximo de aquecimento."
        : "O domínio avançou após três dias elegíveis de volume e saúde.",
  }
}

function isEligibleWarmupDay(day: EmailWarmupHistoryDay): boolean {
  if (day.capacity <= 0 || day.sent <= 0) return false
  const minimumDelivered = Math.max(50, Math.ceil(day.capacity * 0.5))
  const complaintRate = day.complained / day.sent
  const hardBounceRate = day.hardBounced / day.sent
  const totalBounceRate = (day.hardBounced + day.softBounced) / day.sent
  return (
    day.sent / day.capacity >= EMAIL_WARMUP_ADVANCE_USAGE_RATIO &&
    day.delivered >= minimumDelivered &&
    complaintRate < EMAIL_WARMUP_MAX_COMPLAINT_RATE &&
    hardBounceRate < EMAIL_WARMUP_MAX_HARD_BOUNCE_RATE &&
    totalBounceRate < EMAIL_WARMUP_MAX_TOTAL_BOUNCE_RATE
  )
}

export function formatEmailWarmupMessage(input: {
  totalRecipients: number
  remaining: number
  limit: number
  health: EmailDomainHealth
}): string {
  if (input.health === "paused") {
    return "Envio pausado: este domínio não pode aumentar o volume até que a saúde volte ao nível esperado."
  }

  if (input.totalRecipients > input.remaining) {
    return `Esta campanha tem ${input.totalRecipients.toLocaleString("pt-BR")} destinatários, mas ainda há espaço para ${input.remaining.toLocaleString("pt-BR")} hoje. O restante será enviado nas próximas janelas.`
  }

  return `Este domínio está em aquecimento. O envio desta campanha respeitará o limite de ${input.limit.toLocaleString("pt-BR")} e-mails hoje.`
}
