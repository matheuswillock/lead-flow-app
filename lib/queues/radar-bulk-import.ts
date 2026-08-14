import { QueueClient } from "@vercel/queue"

/** Stub até C3 — tópico reservado no vercel.json da Wave 1. */
export const RADAR_BULK_IMPORT_TOPIC = "radar-bulk-import"

const queue = new QueueClient({ region: "gru1" })

export const { handleCallback: handleRadarBulkImportCallback } = queue
