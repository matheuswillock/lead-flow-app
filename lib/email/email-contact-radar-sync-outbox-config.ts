/**
 * Controles de vazao do outbox Radar D9 (EmailContactRadarSyncOutbox).
 *
 * Decisao T4: manter RADAR_SYNC_CONCURRENCY=8 (ja em prod) e subir o batch
 * padrao para 250 (~3000/h com cron a cada 5 min), acima da meta 2300/h.
 * Orcamento de conexoes do worker ≈ concurrency (syncs em paralelo) + 1
 * (claim/metricas); nao reutilizar IMPORT_CRON_CONNECTION_LIMIT.
 */

export const RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE = 250;
export const RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE = 500;
export const RADAR_SYNC_DEFAULT_CONCURRENCY = 8;
export const RADAR_SYNC_MAX_CONCURRENCY = 16;

function parseBoundedPositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function resolveRadarEmailContactSyncOutboxBatchSize(
  env: Record<string, string | undefined> = process.env
): number {
  return parseBoundedPositiveInt(
    env.RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE,
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE,
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE
  );
}

export function resolveRadarSyncConcurrency(
  env: Record<string, string | undefined> = process.env
): number {
  return parseBoundedPositiveInt(
    env.RADAR_SYNC_CONCURRENCY,
    RADAR_SYNC_DEFAULT_CONCURRENCY,
    RADAR_SYNC_MAX_CONCURRENCY
  );
}
