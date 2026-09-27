export const EMAIL_WARMUP_LIMITS = [100, 250, 500, 1000, 2000] as const
export const EMAIL_WARMUP_ADVANCE_USAGE_RATIO = 0.8
export const EMAIL_WARMUP_INACTIVITY_DAYS = 30

export type EmailDomainTemperature = "warming" | "stable"
export type EmailDomainHealth = "healthy" | "attention" | "paused"
export type EmailWarmupStatus = "warming" | "established" | "paused"

export type EmailWarmupSnapshot = {
  stage: number
  limit: number
  used: number
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
    }
  }

  const stage = hasBeenInactive(snapshot.lastActivityAt, now) ? 0 : clampStage(snapshot.stage)
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
  }
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
