import { QueueClient } from "@vercel/queue"

/**
 * Lotes da importação de base Radar (500 linhas por mensagem).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RADAR_BULK_IMPORT_TOPIC = "radar-bulk-import"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RADAR_BULK_IMPORT_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no caller). */
export const RADAR_BULK_IMPORT_QUEUE_PUBLISH_FAILED_TAG = "radar_bulk_import_queue_publish_failed"

export type RadarBulkImportPayload = {
  jobId: string
  batchIndex: number
}

const queue = new QueueClient({ region: "gru1" })

export function buildRadarBulkImportIdempotencyKey(
  payload: RadarBulkImportPayload
): string {
  return `${payload.jobId}:${payload.batchIndex}`
}

export async function publishRadarBulkImportBatch(
  payload: RadarBulkImportPayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(RADAR_BULK_IMPORT_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? buildRadarBulkImportIdempotencyKey(payload),
    retentionSeconds: RADAR_BULK_IMPORT_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleRadarBulkImportCallback } = queue
