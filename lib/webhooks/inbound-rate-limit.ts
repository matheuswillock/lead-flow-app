import { prisma } from "@/app/api/infra/data/prisma"

/**
 * Limitador atômico em Postgres para o webhook de entrada (SPEC 10, DA3).
 *
 * Base: `lib/billing/billing-rate-limit.ts` (janela fixa, limpeza por CTE na
 * mesma query, `where count < limit`) + o `try/catch` fail-closed de
 * `lib/public-forms/rate-limit.ts:60-66`. Tabela própria
 * (`webhooks_inbound_rate_limit_windows`), sem FK — a chave é livre (IP,
 * teamId, webhookId) e não reaproveita a tabela do Pixel (domínio diferente,
 * sem retenção).
 *
 * Reuso: o mesmo `consumeInboundRateLimit` atende a API Studio ([[14]]), com
 * as chaves `api:ip:{ip}`, `api:res:{activationId}` e `api:badtoken:{ip}`.
 */
export type InboundRateLimitOptions = {
  limit: number
  windowMs: number
}

export type InboundRateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

/** Retenção ≥ maior windowMs em uso (hoje 1h, camada webhook/hora). */
export const INBOUND_WEBHOOK_RATE_LIMIT_RETENTION_MS = 2 * 60 * 60_000

export async function consumeInboundRateLimit(
  key: string,
  options: InboundRateLimitOptions,
  now: Date = new Date()
): Promise<InboundRateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / options.windowMs) * options.windowMs)
  const retentionCutoff = new Date(now.getTime() - INBOUND_WEBHOOK_RATE_LIMIT_RETENTION_MS)
  const windowEnd = new Date(windowStart.getTime() + options.windowMs)
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000))

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      with expired_windows as (
        delete from webhooks_inbound_rate_limit_windows
        where "windowStart" < ${retentionCutoff}
      )
      insert into webhooks_inbound_rate_limit_windows (key, "windowStart", count, "createdAt", "updatedAt")
      values (${key}, ${windowStart}, 1, now(), now())
      on conflict (key, "windowStart") do update
        set count = webhooks_inbound_rate_limit_windows.count + 1, "updatedAt" = now()
        where webhooks_inbound_rate_limit_windows.count < ${options.limit}
      returning count
    `

    return { allowed: rows.length === 1, retryAfterSeconds }
  } catch (error) {
    // Fail-closed: instabilidade no banco não pode virar rate limit desligado
    // — é exatamente quando a proteção é mais necessária.
    console.error("[consumeInboundRateLimit] DB error, failing closed:", error)
    return { allowed: false, retryAfterSeconds }
  }
}

const INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS = {
  ip: { limit: 120, windowMs: 60_000 },
  badToken: { limit: 20, windowMs: 5 * 60_000 },
  webhookPerMinute: { limit: 60, windowMs: 60_000 },
  webhookPerHour: { limit: 1000, windowMs: 60 * 60_000 },
  team: { limit: 300, windowMs: 60_000 },
} as const satisfies Record<string, InboundRateLimitOptions>

/**
 * R10-9 (revisão Opus, Protocolo 96) — DA3 pede limites ajustáveis por env
 * sem redeploy de código. `WEBHOOKS_INBOUND_RATE_LIMIT_<CAMADA>` sobrepõe o
 * `limit` (não o `windowMs`, que é estrutural — mudar a janela exige
 * reavaliar a retenção). Valor inválido (não-inteiro, <= 0) ou ausente cai
 * no default — nunca derruba o rate limit por uma env var malformada.
 */
const readLimitOverride = (envVar: string, fallback: number): number => {
  const raw = process.env[envVar]?.trim()
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[inbound-rate-limit] ${envVar} inválido ("${raw}") — usando default ${fallback}`)
    return fallback
  }

  return parsed
}

/** Limites das 4 camadas do webhook de entrada (SPEC 10, DA3). */
export const INBOUND_WEBHOOK_RATE_LIMITS = {
  ip: {
    limit: readLimitOverride("WEBHOOKS_INBOUND_RATE_LIMIT_IP", INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.ip.limit),
    windowMs: INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.ip.windowMs,
  },
  badToken: {
    limit: readLimitOverride(
      "WEBHOOKS_INBOUND_RATE_LIMIT_BAD_TOKEN",
      INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.badToken.limit
    ),
    windowMs: INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.badToken.windowMs,
  },
  webhookPerMinute: {
    limit: readLimitOverride(
      "WEBHOOKS_INBOUND_RATE_LIMIT_WEBHOOK_PER_MINUTE",
      INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.webhookPerMinute.limit
    ),
    windowMs: INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.webhookPerMinute.windowMs,
  },
  webhookPerHour: {
    limit: readLimitOverride(
      "WEBHOOKS_INBOUND_RATE_LIMIT_WEBHOOK_PER_HOUR",
      INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.webhookPerHour.limit
    ),
    windowMs: INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.webhookPerHour.windowMs,
  },
  team: {
    limit: readLimitOverride("WEBHOOKS_INBOUND_RATE_LIMIT_TEAM", INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.team.limit),
    windowMs: INBOUND_WEBHOOK_RATE_LIMIT_DEFAULTS.team.windowMs,
  },
} satisfies Record<string, InboundRateLimitOptions>

export const buildInboundWebhookIpKey = (ip: string): string => `wh-in:ip:${ip}`

export const buildInboundWebhookBadTokenKey = (teamId: string, ip: string): string =>
  `wh-in:badtoken:${teamId}:${ip}`

export const buildInboundWebhookTeamKey = (teamId: string): string => `wh-in:team:${teamId}`

export const buildInboundWebhookKeyForWindow = (
  webhookId: string,
  window: "1m" | "1h"
): string => `wh-in:wh:${webhookId}:${window}`

/**
 * Camada "webhook" da DA3 combina duas janelas (60/min e 1.000/h) — as duas
 * precisam passar. Roda as duas mesmo se a primeira já reprovar, para que o
 * consumo (e a limpeza por retenção) da outra janela não fique pendente.
 */
export async function checkInboundWebhookLayerRateLimit(
  webhookId: string,
  now: Date = new Date()
): Promise<InboundRateLimitResult> {
  const [perMinute, perHour] = await Promise.all([
    consumeInboundRateLimit(
      buildInboundWebhookKeyForWindow(webhookId, "1m"),
      INBOUND_WEBHOOK_RATE_LIMITS.webhookPerMinute,
      now
    ),
    consumeInboundRateLimit(
      buildInboundWebhookKeyForWindow(webhookId, "1h"),
      INBOUND_WEBHOOK_RATE_LIMITS.webhookPerHour,
      now
    ),
  ])

  if (!perMinute.allowed || !perHour.allowed) {
    // R10-11: `retryAfterSeconds` de uma janela é calculado sempre (mesmo
    // quando `allowed: true`) — é só "tempo até o fim desta janela", não
    // "tempo até poder tentar de novo". Só entra no Math.max a janela que
    // de fato estourou; senão um bloqueio de 1 min podia devolver o
    // Retry-After da janela de hora (até 3600s).
    const failingRetryAfters = [
      !perMinute.allowed ? perMinute.retryAfterSeconds : null,
      !perHour.allowed ? perHour.retryAfterSeconds : null,
    ].filter((value): value is number => value !== null)

    return {
      allowed: false,
      retryAfterSeconds: Math.max(...failingRetryAfters),
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}
