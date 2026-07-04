import { prisma } from "@/app/api/infra/data/prisma"

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

/** Persistente via whatsapp_usage_events — consistente entre instâncias serverless. */
export async function isWithinSendRateLimit(teamId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS)
  const count = await prisma.whatsAppUsageEvent.count({
    where: {
      teamId,
      eventType: "OUTBOUND_MESSAGE",
      direction: "OUTBOUND",
      createdAt: { gte: since },
    },
  })
  return count < MAX_PER_WINDOW
}

export const SEND_RATE_LIMIT_MAX_PER_WINDOW = MAX_PER_WINDOW
export const SEND_RATE_LIMIT_WINDOW_MS = WINDOW_MS
