import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"

export function shouldShowOutboundOperatorName(
  message: WhatsAppMessage,
  previousMessage: WhatsAppMessage | null
): boolean {
  if (message.direction !== "OUTBOUND") return false
  if (message.isAutoResponse || !message.sentByProfileId) return false

  if (!previousMessage) return true
  if (previousMessage.direction === "INBOUND") return true
  if (previousMessage.sentByProfileId !== message.sentByProfileId) return true

  return false
}
