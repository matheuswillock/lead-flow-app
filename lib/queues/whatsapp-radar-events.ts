import { QueueClient } from "@vercel/queue"

/** Stub até C4 — tópico reservado no vercel.json da Wave 1. */
export const WHATSAPP_RADAR_EVENTS_TOPIC = "whatsapp-radar-events"

const queue = new QueueClient({ region: "gru1" })

export const { handleCallback: handleWhatsappRadarEventsCallback } = queue
