/**
 * Teto de duração por cron, usado pelo watchdog de execuções órfãs.
 *
 * O kill de plataforma (timeout, OOM, deploy) não passa pelo `catch` do
 * `withCronAudit`: a linha fica `running` para sempre. O watchdog marca essas
 * execuções como `failed`, mas o teto precisa ser **por cronKey** — há crons
 * legitimamente longos (`database-backup` ~5min, `radar-sync-email-contacts`
 * p95 104s) que um teto global marcaria como órfãos por engano.
 *
 * Cada entrada é o `maxDuration` (em segundos) declarado na rota do cron.
 * Quando a rota não declara, vale o default da plataforma.
 */

/** Default de duração das Vercel Functions quando a rota não declara `maxDuration`. */
export const VERCEL_DEFAULT_MAX_DURATION_SECONDS = 300

/** Multiplicador aplicado ao `maxDuration` para chegar ao teto de "está órfã". */
export const STALE_THRESHOLD_MULTIPLIER = 2

/**
 * Teto para `cronKey` desconhecido (cron removido do `vercel.json` cujas linhas
 * antigas continuam na tabela). Generoso, mas abaixo da invariante de 1h.
 */
export const UNKNOWN_CRON_MAX_DURATION_SECONDS = 900

/**
 * `maxDuration` declarado por cada cron do `vercel.json`, indexado pelo
 * `cronKey` que a rota passa ao `withCronAudit`.
 *
 * Mantido em sincronia com as rotas por `cronStaleThresholds.test.ts`, que
 * falha quando um cron novo entra no `vercel.json` sem teto aqui.
 */
export const CRON_MAX_DURATION_SECONDS: Readonly<Record<string, number>> = {
  "asaas-webhook-retry": 60,
  "backoffice-email-import": 60,
  "cleanup-orphan-media": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "database-backup": 300,
  "dispatch-email-campaigns": 60,
  "dispatch-scheduled": 60,
  "document-request-reminders": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "email-import": 60,
  "email-orphan-events-drain": 300,
  "email-resend-domain-status-reconcile": 60,
  "email-resend-webhook-retry": 60,
  "engagement-backfill": 300,
  "evaluate-idle": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "ingest-media": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "lead-status-batch": 60,
  "mark-stale-cron-executions": 60,
  "meeting-follow-up": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "meeting-reminders": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "member-pro-expiration": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "overdue-reminder": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "provision-live-campaign": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "public-forms-mark-abandoned-sessions": 60,
  "public-forms-queue-event-failures-retry": 60,
  "public-forms-submission-dispatch": 60,
  "queue-processing-failures-retry": 60,
  "radar-import": 60,
  "radar-sync-email-contacts": 300,
  "reset-credits": 60,
  "studio-bot-ai-rollup": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "studio-bot-outbox": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "sync-contacts": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "task-overdue": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "webhook-outbox": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
  "whatsapp-outbox": VERCEL_DEFAULT_MAX_DURATION_SECONDS,
}

/** Teto, em milissegundos, além do qual uma execução `running` é considerada órfã. */
export function resolveStaleThresholdMs(cronKey: string): number {
  const maxDurationSeconds =
    CRON_MAX_DURATION_SECONDS[cronKey] ?? UNKNOWN_CRON_MAX_DURATION_SECONDS
  return maxDurationSeconds * STALE_THRESHOLD_MULTIPLIER * 1000
}

/**
 * Menor teto entre todos os crons conhecidos. Serve de piso para a busca de
 * candidatos: nada mais novo que isso pode estar órfão em nenhum cronKey.
 */
export function resolveMinimumStaleThresholdMs(): number {
  const thresholds = Object.keys(CRON_MAX_DURATION_SECONDS).map(resolveStaleThresholdMs)
  return Math.min(...thresholds)
}
