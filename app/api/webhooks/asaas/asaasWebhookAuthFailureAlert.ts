import * as Sentry from "@sentry/nextjs"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"

/**
 * E7 (X3, T-30.24): sintoma de C36 — o Asaas pausa a fila de webhooks
 * depois de falhas consecutivas de autenticação. N 401 na mesma janela
 * horária escalam a severidade do alerta em vez de gerar um evento
 * idêntico repetido (que o Sentry deduplica por fingerprint e ninguém
 * nota a diferença entre 1 e 50 ocorrências).
 *
 * Reusa `consumeBillingRateLimit` (S2, já testado e atômico via UPSERT
 * condicional — `lib/billing/billing-rate-limit.ts`) com uma chave e uma
 * janela PRÓPRIAS, dedicadas só à decisão de escalar: `allowed: false`
 * aqui não bloqueia nada (não é usado para responder 429 — isso já é
 * responsabilidade de `rejectIfInvalidTokenRateLimited` em `route.ts`),
 * só sinaliza que o limiar de escalação foi atingido na janela.
 */
const ESCALATION_KEY = "asaas-webhook-auth-failure-escalation"
const ESCALATION_WINDOW_MS = 60 * 60_000
const DEFAULT_ESCALATION_THRESHOLD = 5

export function getAsaasWebhookAuthFailureEscalationThreshold(): number {
  const raw = process.env.ASAAS_WEBHOOK_AUTH_FAILURE_ESCALATION_THRESHOLD
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_ESCALATION_THRESHOLD
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ESCALATION_THRESHOLD
}

/** Mascara o token recebido para o alerta — nunca o segredo completo em texto. */
export function maskAsaasWebhookToken(token: string | null | undefined): string {
  if (!token) return "(ausente)"
  if (token.length <= 8) return "***"
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

export type AsaasWebhookAuthRejectionReason = "missing_token" | "invalid_token"

export async function reportAsaasWebhookAuthRejected(input: {
  reason: AsaasWebhookAuthRejectionReason
  receivedToken: string | null
}): Promise<{ escalated: boolean }> {
  const escalationCheck = await consumeBillingRateLimit(ESCALATION_KEY, {
    limit: getAsaasWebhookAuthFailureEscalationThreshold(),
    windowMs: ESCALATION_WINDOW_MS,
  })
  const escalated = !escalationCheck.allowed

  const tags: Record<string, string> = { route: "AsaasWebhookRoute", phase: "auth-rejected" }
  if (escalated) tags.escalated = "true"

  const message =
    input.reason === "missing_token"
      ? "[AsaasWebhookRoute] Token não fornecido"
      : "[AsaasWebhookRoute] Token inválido"

  Sentry.captureMessage(message, {
    level: escalated ? "fatal" : "warning",
    tags,
    extra: { maskedToken: maskAsaasWebhookToken(input.receivedToken) },
  })

  return { escalated }
}
