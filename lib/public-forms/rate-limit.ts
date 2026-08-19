import { prisma } from "@/app/api/infra/data/prisma"

type Bucket = { count: number; resetAt: number }

const memoryBuckets = new Map<string, Bucket>()
let forceMemoryStore = false

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

function consumeMemoryRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now()
  const current = memoryBuckets.get(key)
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  current.count += 1
  if (current.count <= options.limit) return { allowed: true, retryAfterSeconds: 0 }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  }
}

/**
 * Atomic shared limiter backed by Postgres so Vercel function instances share the same budget.
 * Falls back to in-memory only when explicitly forced for unit tests.
 */
export async function consumePublicFormRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  if (forceMemoryStore) {
    return consumeMemoryRateLimit(key, options)
  }

  const now = new Date()
  const resetAt = new Date(now.getTime() + options.windowMs)

  let rows: Array<{ count: number; resetAt: Date }>
  try {
    rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "corretor_studio_public_form_rate_limits" ("key", "count", "resetAt", "updatedAt")
      VALUES (${key}, 1, ${resetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "corretor_studio_public_form_rate_limits"."resetAt" <= ${now} THEN 1
          ELSE "corretor_studio_public_form_rate_limits"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "corretor_studio_public_form_rate_limits"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "corretor_studio_public_form_rate_limits"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `
  } catch (error) {
    // Fail-closed: instabilidade no banco não pode virar rate limit
    // desligado — é justo quando o sistema está sob carga que precisa da
    // proteção. Backoff curto porque é bem provável ser uma falha transitória.
    console.error("[consumePublicFormRateLimit] DB error, failing closed:", error)
    return { allowed: false, retryAfterSeconds: 30 }
  }

  const row = rows[0]
  if (!row) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (row.count <= options.limit) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
  }
}

/**
 * Fingerprint por IP sozinho é trivialmente contornável (rotação de IP,
 * spoof de header) — combinar com `visitorSessionId` (cookie first-party de
 * sessão, não previsível de fora) fecha esse buraco sem precisar de nenhuma
 * infra nova. `visitorSessionId` é opcional só pra manter a assinatura
 * retrocompatível onde o corpo da request ainda não foi parseado.
 */
export function publicFormRequestFingerprint(request: Request, visitorSessionId?: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown"
  return visitorSessionId ? `${ip}:${visitorSessionId}` : ip
}

export function resetPublicFormRateLimitsForTests() {
  forceMemoryStore = true
  memoryBuckets.clear()
}
