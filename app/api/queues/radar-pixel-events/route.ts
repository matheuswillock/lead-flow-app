import { handleRadarPixelEventsCallback } from "@/lib/queues/radar-pixel-events"

/** Stub até C1 — ack imediato para o trigger do vercel.json existir no deploy. */
export const POST = handleRadarPixelEventsCallback(async () => undefined, {
  retry: () => ({ afterSeconds: 60 }),
})
