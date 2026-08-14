import { handleWhatsappRadarEventsCallback } from "@/lib/queues/whatsapp-radar-events"

/** Stub até C4 — ack imediato para o trigger do vercel.json existir no deploy. */
export const POST = handleWhatsappRadarEventsCallback(async () => undefined, {
  retry: () => ({ afterSeconds: 60 }),
})
