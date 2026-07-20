import { prisma } from "@/app/api/infra/data/prisma"

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

/**
 * Reserva um slot com UPSERT condicional. A decisão e o incremento são uma única
 * operação SQL, portanto duas funções serverless não conseguem ultrapassar o limite.
 */
export async function consumeSendRateLimit(teamId: string, now = new Date()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS)
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    insert into whatsapp_send_rate_limit_windows ("teamId", "windowStart", count, "createdAt", "updatedAt")
    values (${teamId}::uuid, ${windowStart}, 1, now(), now())
    on conflict ("teamId", "windowStart") do update
      set count = whatsapp_send_rate_limit_windows.count + 1, "updatedAt" = now()
      where whatsapp_send_rate_limit_windows.count < ${MAX_PER_WINDOW}
    returning count
  `
  return rows.length === 1
}

export const SEND_RATE_LIMIT_MAX_PER_WINDOW = MAX_PER_WINDOW
export const SEND_RATE_LIMIT_WINDOW_MS = WINDOW_MS
