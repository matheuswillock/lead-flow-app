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
 * Fora do escopo deste critério:
 * - `queued` sem `failed` (órfãos / stuck — fluxo `resumeOrphanSendingDispatches`)
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

/**
 * Seleciona e-mails elegíveis para redisparo de falhas a partir dos logs da campanha.
 * Entrada tipicamente vem de `emailLog.findMany({ where: { campaignId }, select: { recipientEmail, status } })`.
 */
export function selectFailedRecipientEmailsForRetry(
  logs: CampaignFailedRecipientLogRow[]
): string[] {
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
}): string[] {
  if (params.hasRetriableStatus && !params.hasAnyLog) {
    return normalizeEmailList(params.resolvedAudienceEmails)
  }
  return selectFailedRecipientEmailsForRetry(params.logs)
}
