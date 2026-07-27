import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"
import { shouldApplyOutboundMessageStatus } from "@/lib/whatsapp/outbound-message-status"

function coalesceField<T>(incoming: T | null | undefined, existing: T | null | undefined): T | null {
  if (incoming === null || incoming === undefined) return existing ?? null
  return incoming
}

/**
 * Merges an inbound Realtime/HTTP message into the local list without wiping
 * authoritative fields with synthetic nulls from the HTTP path.
 */
export function mergeMessageFields(
  existing: WhatsAppMessage,
  incoming: WhatsAppMessage
): WhatsAppMessage {
  const mergedStatus =
    (existing.direction === "OUTBOUND" || incoming.direction === "OUTBOUND") &&
    !shouldApplyOutboundMessageStatus(String(existing.status), String(incoming.status))
      ? existing.status
      : incoming.status

  return {
    ...existing,
    ...incoming,
    status: mergedStatus,
    clientMessageId: coalesceField(incoming.clientMessageId, existing.clientMessageId),
    contentText: coalesceField(incoming.contentText, existing.contentText),
    mediaUrl: coalesceField(incoming.mediaUrl, existing.mediaUrl),
    caption: coalesceField(incoming.caption, existing.caption),
    senderDisplayName: coalesceField(incoming.senderDisplayName, existing.senderDisplayName),
    mediaFileName: coalesceField(incoming.mediaFileName, existing.mediaFileName),
    linkPreview: coalesceField(incoming.linkPreview, existing.linkPreview),
    sentByProfileId: coalesceField(incoming.sentByProfileId, existing.sentByProfileId),
    senderPhone: coalesceField(incoming.senderPhone, existing.senderPhone),
    recipientPhone: coalesceField(incoming.recipientPhone, existing.recipientPhone),
    sentAt: coalesceField(incoming.sentAt, existing.sentAt),
    deliveredAt: coalesceField(incoming.deliveredAt, existing.deliveredAt),
    readAt: coalesceField(incoming.readAt, existing.readAt),
    playedAt: coalesceField(incoming.playedAt, existing.playedAt),
    failedAt: coalesceField(incoming.failedAt, existing.failedAt),
    mentionedJids: coalesceField(incoming.mentionedJids, existing.mentionedJids),
  }
}

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
    return prev.map((m) => (m.id === incoming.id ? mergeMessageFields(m, incoming) : m))
  }

  if (incoming.clientMessageId) {
    const optimisticIdx = prev.findIndex(
      (m) =>
        m.clientMessageId === incoming.clientMessageId &&
        (m.id.startsWith("optimistic-") || m.id !== incoming.id)
    )
    if (optimisticIdx >= 0) {
      const next = [...prev]
      next[optimisticIdx] = mergeMessageFields(next[optimisticIdx]!, {
        ...incoming,
        clientMessageId: incoming.clientMessageId,
      })
      return next
    }
  }

  return [...prev, incoming]
}
