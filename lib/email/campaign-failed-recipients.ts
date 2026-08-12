import type { EmailLogStatus } from "@prisma/client"

/**
 * Critério de "falhou e ainda precisa receber" (retry failed only):
 *
 * Incluir o e-mail se, nos logs da campanha:
 * 1. Existe pelo menos um log com status `failed`
 * 2. NÃO existe log com status de sucesso no provedor (abaixo)
 * 3. NÃO existe log `suppressed` (contato bloqueado / não deve receber)
 *
 * Sucesso no provedor (NÃO redisparar):
 * - `sent` | `delivered` | `opened` | `clicked` — entregues ou engajados
 * - `bounced` | `complained` — já chegaram ao provedor; reenviar seria duplicata
 *   e/ou prejudicaria reputação
 *
 * `queued` sem `failed`:
 * - Enquanto a campanha/dispatch ainda está `sending`, é tratado pelo fluxo
 *   `resumeOrphanSendingDispatches` (órfão em andamento, não uma falha).
 * - Se a campanha/dispatch já chegou a um status terminal (`failed`/`partially_sent`,
 *   ex.: timeout de 30 min de `recoverStuckSendingCampaigns`) e ainda assim sobraram
 *   logs `queued`, esses destinatários nunca serão retomados por nenhum cron — nesse
 *   caso `includeStuckQueued: true` (ver `selectFailedRecipientEmailsForRetry`) os
 *   trata como elegíveis para "Reenviar apenas falhas".
 */
export const CAMPAIGN_PROVIDER_SUCCESS_LOG_STATUSES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const satisfies ReadonlyArray<EmailLogStatus>

export const CAMPAIGN_RETRY_FAILURE_LOG_STATUS = "failed" as const satisfies EmailLogStatus

export const CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES = [
  "suppressed",
] as const satisfies ReadonlyArray<EmailLogStatus>

export type CampaignFailedRecipientLogRow = {
  recipientEmail: string
  status: EmailLogStatus
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Status de log que nunca chegou a um desfecho terminal (nem aceito, nem falho). */
export const CAMPAIGN_RETRY_STUCK_LOG_STATUS = "queued" as const satisfies EmailLogStatus

export type SelectFailedRecipientEmailsOptions = {
  /**
   * Quando `true`, também trata logs `queued` (nunca resolvidos — dispatch travou/
   * timeout antes de chegar a um desfecho terminal) como elegíveis para redisparo.
   * Só deve ser `true` quando a campanha/dispatch já está em status terminal
   * (`failed`/`partially_sent`) — nesse ponto o `queued` é definitivamente órfão,
   * não "em andamento" (isso continua sendo tratado por `resumeOrphanSendingDispatches`).
   */
  includeStuckQueued?: boolean
}

/**
 * Seleciona e-mails elegíveis para redisparo de falhas a partir dos logs da campanha.
 * Entrada tipicamente vem de `emailLog.findMany({ where: { campaignId }, select: { recipientEmail, status } })`.
 */
export function selectFailedRecipientEmailsForRetry(
  logs: CampaignFailedRecipientLogRow[],
  options?: SelectFailedRecipientEmailsOptions
): string[] {
  const includeStuckQueued = options?.includeStuckQueued ?? false
  const successEmails = new Set<string>()
  const excludedEmails = new Set<string>()
  const failedEmails = new Set<string>()

  for (const log of logs) {
    const email = normalizeEmail(log.recipientEmail)
    if (!email) continue

    if ((CAMPAIGN_PROVIDER_SUCCESS_LOG_STATUSES as readonly string[]).includes(log.status)) {
      successEmails.add(email)
      continue
    }

    if ((CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES as readonly string[]).includes(log.status)) {
      excludedEmails.add(email)
      continue
    }

    if (log.status === CAMPAIGN_RETRY_FAILURE_LOG_STATUS) {
      failedEmails.add(email)
      continue
    }

    if (includeStuckQueued && log.status === CAMPAIGN_RETRY_STUCK_LOG_STATUS) {
      failedEmails.add(email)
    }
  }

  const eligible: string[] = []
  for (const email of failedEmails) {
    if (successEmails.has(email)) continue
    if (excludedEmails.has(email)) continue
    eligible.push(email)
  }

  return eligible.sort()
}

function normalizeEmailList(emails: string[]): string[] {
  const normalized = new Set<string>()
  for (const email of emails) {
    const value = normalizeEmail(email)
    if (value) normalized.add(value)
  }
  return [...normalized].sort()
}

/**
 * Resolve os e-mails a redisparar no modo "Reenviar apenas falhas".
 *
 * Existe um modo de falha em que a tentativa anterior morreu **antes** de criar
 * qualquer `EmailLog` (ex.: validação de variáveis abortou antes do dispatch).
 * Nesse caso `selectFailedRecipientEmailsForRetry` devolve `[]` (não há log `failed`),
 * e a UI reporta "0 destinatários com falha" mesmo com ninguém tendo recebido nada.
 *
 * Regra:
 * - Se a campanha está em status retriável e **não há log algum** (`hasAnyLog === false`),
 *   ninguém recebeu → devolver **toda** a audiência resolvida (`resolvedAudienceEmails`).
 * - Caso contrário, manter o critério por logs `failed` (sem regressão para o modo
 *   "logs existentes com falhas", ex.: lote 403 da Resend).
 */
export function resolveRetryRecipientEmails(params: {
  hasAnyLog: boolean
  hasRetriableStatus: boolean
  logs: CampaignFailedRecipientLogRow[]
  resolvedAudienceEmails: string[]
  /** Ver `SelectFailedRecipientEmailsOptions.includeStuckQueued`. */
  includeStuckQueued?: boolean
}): string[] {
  if (params.hasRetriableStatus && !params.hasAnyLog) {
    return normalizeEmailList(params.resolvedAudienceEmails)
  }
  return selectFailedRecipientEmailsForRetry(params.logs, {
    includeStuckQueued: params.includeStuckQueued,
  })
}
