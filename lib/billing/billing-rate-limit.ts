import { prisma } from "@/app/api/infra/data/prisma"

/**
 * Rate limit atômico para billing (S2, [[50 — Backoffice de Cobrança —
 * Backend]] E2, DA2). Mesmo padrão UPSERT condicional de
 * `lib/whatsapp/send-rate-limit.ts` — decisão e incremento numa única
 * operação SQL, então duas instâncias serverless não conseguem ultrapassar
 * o teto. Diferente do WhatsApp (chave = teamId), aqui a chave é livre
 * (IP, profileId, backofficeUserId) — sem FK, tabela própria.
 */
export type BillingRateLimitOptions = {
  limit: number
  windowMs: number
}

export type BillingRateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Retenção (achado codex no PR #1134): a chave inclui IP influenciado por
 * atacante, então sem limpeza a tabela cresce sem limite. Janela expirada há
 * mais de 1h não afeta nenhuma decisão — o maior windowMs em uso é 60min
 * (instruções DNS, `lib/email/dns-instructions-rate-limit.ts`), e a janela
 * corrente sempre tem windowStart > now − windowMs, então nunca cai no
 * cutoff de 1h. A limpeza roda como CTE na mesma operação do consumo, sem
 * cron novo, apoiada no índice de "windowStart" da migration. Ao adotar um
 * windowMs novo, mantenha BILLING_RATE_LIMIT_RETENTION_MS ≥ windowMs.
 */
export const BILLING_RATE_LIMIT_RETENTION_MS = 60 * 60_000

export async function consumeBillingRateLimit(
  key: string,
  options: BillingRateLimitOptions,
  now = new Date()
): Promise<BillingRateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / options.windowMs) * options.windowMs)
  const retentionCutoff = new Date(now.getTime() - BILLING_RATE_LIMIT_RETENTION_MS)

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    with expired_windows as (
      delete from billing_rate_limit_windows
      where "windowStart" < ${retentionCutoff}
    )
    insert into billing_rate_limit_windows (key, "windowStart", count, "createdAt", "updatedAt")
    values (${key}, ${windowStart}, 1, now(), now())
    on conflict (key, "windowStart") do update
      set count = billing_rate_limit_windows.count + 1, "updatedAt" = now()
      where billing_rate_limit_windows.count < ${options.limit}
    returning count
  `

  const windowEnd = new Date(windowStart.getTime() + options.windowMs)
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000))

  return { allowed: rows.length === 1, retryAfterSeconds }
}

/** Limites default — calibração de engenharia, ajustável por env (ver rotas consumidoras). */
export const BILLING_RATE_LIMIT_DEFAULTS = {
  webhookInvalidToken: { limit: 30, windowMs: 5 * 60_000 },
  checkoutCreate: { limit: 10, windowMs: 60_000 },
  backofficePricing: { limit: 20, windowMs: 60_000 },
} as const
