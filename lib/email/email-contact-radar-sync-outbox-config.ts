/**
 * Controles de vazão do outbox Radar D9 (EmailContactRadarSyncOutbox).
 *
 * Decisão T4: manter RADAR_SYNC_CONCURRENCY=8 (já em prod) e subir o batch
 * padrão para 250 (~3000/h com cron a cada 5 min), acima da meta 2300/h.
 * Orçamento de conexões do worker ≈ concurrency (syncs em paralelo) + 1
 * (claim/métricas); não reutilizar IMPORT_CRON_CONNECTION_LIMIT.
 *
 * Overrides do backoffice (tabela backoffice_radar_outbox_throughput_configs)
 * têm precedência sobre env, sempre clampados aos min/max abaixo.
 */

export const RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE = 1;
export const RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE = 250;
export const RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE = 500;

export const RADAR_SYNC_MIN_CONCURRENCY = 1;
export const RADAR_SYNC_DEFAULT_CONCURRENCY = 8;
export const RADAR_SYNC_MAX_CONCURRENCY = 16;

/** Cron a cada 5 minutos → 12 execuções/hora. */
export const RADAR_OUTBOX_CRON_RUNS_PER_HOUR = 12;

export type RadarOutboxThroughputLimits = {
  minBatchSize: number;
  maxBatchSize: number;
  defaultBatchSize: number;
  minConcurrency: number;
  maxConcurrency: number;
  defaultConcurrency: number;
  cronRunsPerHour: number;
};

export const RADAR_OUTBOX_THROUGHPUT_LIMITS: RadarOutboxThroughputLimits = {
  minBatchSize: RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE,
  maxBatchSize: RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE,
  defaultBatchSize: RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE,
  minConcurrency: RADAR_SYNC_MIN_CONCURRENCY,
  maxConcurrency: RADAR_SYNC_MAX_CONCURRENCY,
  defaultConcurrency: RADAR_SYNC_DEFAULT_CONCURRENCY,
  cronRunsPerHour: RADAR_OUTBOX_CRON_RUNS_PER_HOUR,
};

function parseBoundedPositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

export function clampRadarOutboxBatchSize(value: number): number {
  if (!Number.isFinite(value) || value < RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE) {
    return RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE;
  }
  return Math.min(
    Math.trunc(value),
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE
  );
}

export function clampRadarOutboxConcurrency(value: number): number {
  if (!Number.isFinite(value) || value < RADAR_SYNC_MIN_CONCURRENCY) {
    return RADAR_SYNC_DEFAULT_CONCURRENCY;
  }
  return Math.min(Math.trunc(value), RADAR_SYNC_MAX_CONCURRENCY);
}

export function resolveRadarEmailContactSyncOutboxBatchSize(
  env: Record<string, string | undefined> = process.env
): number {
  return parseBoundedPositiveInt(
    env.RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE,
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE,
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE,
    RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE
  );
}

export function resolveRadarSyncConcurrency(
  env: Record<string, string | undefined> = process.env
): number {
  return parseBoundedPositiveInt(
    env.RADAR_SYNC_CONCURRENCY,
    RADAR_SYNC_DEFAULT_CONCURRENCY,
    RADAR_SYNC_MIN_CONCURRENCY,
    RADAR_SYNC_MAX_CONCURRENCY
  );
}

export function estimateRadarOutboxThroughputPerHour(batchSize: number): number {
  return clampRadarOutboxBatchSize(batchSize) * RADAR_OUTBOX_CRON_RUNS_PER_HOUR;
}
