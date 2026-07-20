/**
 * Claim atômico de entrega outbound antes de chamar N8N/Evolution.
 * Evita reenvio WhatsApp quando o HTTP de resposta se perde mas a mensagem já foi aceita.
 */
export type OutboundDeliveryClaimResult = "acquired" | "completed" | "busy";

/** Após este tempo, um claim `processing` pode ser reassumido (N8N caiu antes do side-effect). */
export const OUTBOUND_DELIVERY_STALE_MS = 15 * 60 * 1000;

export function isOutboundDeliveryClaimStale(
  updatedAt: Date,
  now = new Date(),
  staleMs = OUTBOUND_DELIVERY_STALE_MS
): boolean {
  return now.getTime() - updatedAt.getTime() >= staleMs;
}
