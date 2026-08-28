/**
 * Copy e classificação do disparo manual (lista, ficha e toast).
 *
 * Retry de falhas só quando alguém já recebeu (`totalSent > 0`). Campanha
 * `failed`/`partially_sent` com zero enviados é o primeiro Disparar.
 */

import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { ApiRequestError, isApiRequestError } from "@/lib/http/api-request-error"

export const CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE =
  "Ocorreu um erro ao disparar a campanha"

/** Persistido em `EmailCampaignDispatch.errorMessage` quando o usuário cancela o envio. */
export const EMAIL_CAMPAIGN_USER_CANCELED_MESSAGE = "Cancelado pelo usuário"

export const CAMPAIGN_CANCEL_SENDING_UNSENT_COPY =
  "Destinatários que ainda não foram enviados não serão disparados."

export const CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY =
  "O que o Resend já aceitou permanece enviado."

/** Constante INTERNAL antiga persistida em campanhas já falhas. */
const LEGACY_INTERNAL_ERROR_MESSAGE = "Erro interno durante o disparo"

/** HTTP 400 ainda mapeia INTERNAL para esta frase curta. */
const HTTP_INTERNAL_ERROR_MESSAGE = "Erro ao disparar campanha"

/** Mensagem técnica de `EMAIL_CAMPAIGN_FAILURE_MESSAGES.STUCK_SENDING` (EmailCampaignUseCase.ts). */
const STUCK_SENDING_ERROR_MESSAGE =
  "Disparo interrompido: tempo limite de envio excedido (30 min)"

export function isCampaignFailedRetry(campaign: {
  status: string
  totalSent?: number | null
}): boolean {
  const totalSent = campaign.totalSent ?? 0
  return (
    (campaign.status === "failed" || campaign.status === "partially_sent") &&
    totalSent > 0
  )
}

export function campaignDispatchSendOptions(campaign: {
  status: string
  totalSent?: number | null
}): { retryFailedOnly: true } | undefined {
  return isCampaignFailedRetry(campaign) ? { retryFailedOnly: true } : undefined
}

export function formatCampaignDispatchErrorMessage(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return raw

  if (
    trimmed === CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE ||
    trimmed === LEGACY_INTERNAL_ERROR_MESSAGE ||
    trimmed === HTTP_INTERNAL_ERROR_MESSAGE ||
    trimmed.includes("Erro interno")
  ) {
    return CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE
  }

  if (trimmed === STUCK_SENDING_ERROR_MESSAGE) {
    return CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE
  }

  return raw
}

/**
 * Converte o erro capturado no catch de `handleSend` (CampanhasHook.ts) na
 * mensagem final do toast: aplica a copy conhecida (INTERNAL/STUCK_SENDING)
 * via `formatCampaignDispatchErrorMessage` e preserva a etiqueta
 * `ApiRequestError` (Output.errorMessages da nossa própria rota) antes de
 * repassar para `toUserToastMessage`.
 *
 * Achado de review (PR #1085): extrair `err.message` como string pura ANTES
 * desta etapa descarta a classe `ApiRequestError` — a heurística de
 * acento/PRODUCT_PORTUGUESE_MARKERS de `toUserToastMessage` volta a mascarar
 * mensagens de produto sem acento como "Ocorreu um erro." (regressão Calli),
 * mesmo com o service e o helper de toast já corrigidos.
 */
export function resolveDispatchErrorToastMessage(err: unknown, fallback: string): string {
  const rawMessage = err instanceof Error ? err.message : ""
  const formattedMessage = formatCampaignDispatchErrorMessage(rawMessage) ?? rawMessage
  const text = formattedMessage || fallback
  return toUserToastMessage(isApiRequestError(err) ? new ApiRequestError(text, err.status) : text)
}
