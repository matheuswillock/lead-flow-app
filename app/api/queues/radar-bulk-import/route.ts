import { handleRadarBulkImportCallback } from "@/lib/queues/radar-bulk-import"

/** Stub até C3 — ack imediato para o trigger do vercel.json existir no deploy. */
export const POST = handleRadarBulkImportCallback(async () => undefined, {
  retry: () => ({ afterSeconds: 60 }),
})
