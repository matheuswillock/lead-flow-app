import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"

/**
 * Merges an inbound Realtime/HTTP message into the local list, collapsing
 * optimistic bubbles that share the same clientMessageId (exactly one bubble
 * per outbound intent).
 */
export function mergeMessageByClientId(
  prev: WhatsAppMessage[],
  incoming: WhatsAppMessage
): WhatsAppMessage[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m))
  }

  if (incoming.clientMessageId) {
    const optimisticIdx = prev.findIndex(
      (m) =>
        m.clientMessageId === incoming.clientMessageId &&
        (m.id.startsWith("optimistic-") || m.id !== incoming.id)
    )
    if (optimisticIdx >= 0) {
      const next = [...prev]
      next[optimisticIdx] = {
        ...next[optimisticIdx],
        ...incoming,
        clientMessageId: incoming.clientMessageId,
      }
      return next
    }
  }

  return [...prev, incoming]
}
