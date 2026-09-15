import {
  consumeBillingRateLimit,
  type BillingRateLimitResult,
} from "@/lib/billing/billing-rate-limit"

/**
 * Teto por TIME para o envio de instruções DNS por e-mail (achado codex no
 * PR #1173): um manager autenticado podia POSTar destinatário arbitrário em
 * loop — spam relay com o remetente da plataforma e queima da quota
 * compartilhada do provedor. 5/hora cobre o uso legítimo (reenviar para outro
 * responsável técnico) e inviabiliza abuso.
 *
 * Reusa o janelamento atômico de `lib/billing/billing-rate-limit`: a tabela
 * foi desenhada com chave livre (sem FK) exatamente para novos consumidores,
 * e o UPSERT condicional decide e incrementa numa única operação SQL — duas
 * instâncias serverless não ultrapassam o teto juntas.
 */
export const DNS_INSTRUCTIONS_SEND_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60_000,
} as const

export const DNS_INSTRUCTIONS_SEND_RATE_LIMIT_MESSAGE =
  "Limite de envios de instruções atingido. Tente novamente em alguns minutos."

export function consumeDnsInstructionsSendRateLimit(
  teamId: string,
  now = new Date()
): Promise<BillingRateLimitResult> {
  return consumeBillingRateLimit(
    `dns-instructions:${teamId}`,
    DNS_INSTRUCTIONS_SEND_RATE_LIMIT,
    now
  )
}
