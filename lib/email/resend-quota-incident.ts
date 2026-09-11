/**
 * Cota mensal do provedor estourada é **incidente nomeado**, não silêncio.
 *
 * Em 7 dias a auditoria contou 673 ocorrências de 429 `monthly_quota_exceeded`
 * — 514 no disparo de campanha e 159 em transacional (`forgot-password`,
 * lembretes de documento, follow-up de reunião). O código já detectava e
 * abortava certo; o que faltava era circuito de visibilidade: ninguém sabia que
 * estava acontecendo, e recuperação de senha falhava muda.
 *
 * A tag existe para virar alerta no drain de log (Axiom): é uma string estável
 * e pesquisável, não prosa.
 */
import { isResendMonthlyQuotaExceeded } from "@/lib/email/is-retryable-resend-batch-error"

export const RESEND_MONTHLY_QUOTA_TAG = "resend_monthly_quota_exceeded"

export type ResendQuotaIncidentContext = {
  /** `campaign_dispatch` ou `transactional` — onde a cota mordeu. */
  surface: "campaign_dispatch" | "transactional"
  teamId?: string | null
  campaignId?: string | null
  dispatchId?: string | null
  category?: string | null
  recipientCount?: number | null
  message?: string | null
}

export type ResendQuotaIncidentLog = ResendQuotaIncidentContext & {
  tag: typeof RESEND_MONTHLY_QUOTA_TAG
}

export function buildResendQuotaIncidentLog(
  context: ResendQuotaIncidentContext
): ResendQuotaIncidentLog {
  return { tag: RESEND_MONTHLY_QUOTA_TAG, ...context }
}

/**
 * Log estruturado com a tag no início da mensagem — o drain casa por prefixo, e
 * o objeto carrega o contexto para o alerta dizer *qual* superfície morreu.
 */
export function logResendMonthlyQuotaIncident(context: ResendQuotaIncidentContext): void {
  console.error(`[${RESEND_MONTHLY_QUOTA_TAG}]`, buildResendQuotaIncidentLog(context))
}

/**
 * Decisão do transacional diante de um erro do provedor: é cota ou é outra
 * coisa? Vive aqui, e não dentro do `EmailService`, por uma razão prática — o
 * módulo do `EmailService` é substituído por `mock.module` em vários arquivos
 * de teste, então um teste que o importasse quebraria dependendo da ordem de
 * execução. Este módulo ninguém mocka, e é o comportamento real que roda em
 * produção.
 */
export function resolveTransactionalQuotaFailure(
  error: { name?: string; message?: string },
  context: Omit<ResendQuotaIncidentContext, "surface" | "message">
): { errorTag?: typeof RESEND_MONTHLY_QUOTA_TAG } {
  if (!isResendMonthlyQuotaExceeded({ name: error.name, message: error.message })) {
    return {}
  }

  logResendMonthlyQuotaIncident({
    surface: "transactional",
    ...context,
    message: error.message ?? null,
  })

  return { errorTag: RESEND_MONTHLY_QUOTA_TAG }
}

/** Primeiro instante do mês corrente — a cota do Resend é mensal e reseta aí. */
export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * O incidente vale enquanto o mês não virar. Não há como perguntar "quanto
 * sobrou de cota" à API do Resend, então o sinal é o próprio estouro anterior —
 * conservador de propósito: recusar um disparo que iria falhar é melhor que
 * aceitar 900 destinatários para virarem `failed` mudos.
 */
export function isMonthlyQuotaIncidentActive(
  lastIncidentAt: Date | null | undefined,
  now: Date
): boolean {
  if (!lastIncidentAt) return false
  return lastIncidentAt.getTime() >= startOfMonthUtc(now).getTime()
}
