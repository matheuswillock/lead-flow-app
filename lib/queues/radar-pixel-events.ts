import { QueueClient } from "@vercel/queue"

/** Stub até C1 — tópico reservado no vercel.json da Wave 1. */
export const RADAR_PIXEL_EVENTS_TOPIC = "radar-pixel-events"

const queue = new QueueClient({ region: "gru1" })

export const { handleCallback: handleRadarPixelEventsCallback } = queue
