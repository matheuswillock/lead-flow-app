import type { MessagingMessage } from "@/components/messaging/types"
import type {
  BackofficeStudioBotChannel,
  BackofficeStudioBotMessage,
} from "../context/BackofficeStudioBotTypes"
import type { BotMessagePayload } from "@/lib/studio-bot/types"

function mapMessageType(messageType: string): string {
  return messageType.toUpperCase()
}

function mapDirection(direction: "inbound" | "outbound"): MessagingMessage["direction"] {
  return direction === "outbound" ? "OUTBOUND" : "INBOUND"
}

export function mapBotMessageToBubble(
  message: BackofficeStudioBotMessage,
  channel: BackofficeStudioBotChannel | null
): MessagingMessage {
  const payload = message.payload as BotMessagePayload

  return {
    id: message.id,
    direction: mapDirection(message.direction),
    messageType: mapMessageType(payload.messageType ?? "text"),
    status: message.direction === "outbound" ? "SENT" : "RECEIVED",
    contentText: payload.contentText ?? null,
    caption: payload.caption ?? null,
    mediaFileName: payload.mediaFileName ?? null,
    mediaUrl: payload.mediaUrl ?? null,
    linkPreview: payload.linkPreview ?? null,
    senderDisplayName:
      message.direction === "outbound"
        ? channel?.displayName ?? "Bethânia"
        : payload.pushName ?? null,
    sentAt: message.createdAt,
    createdAt: message.createdAt,
    isAutoResponse: message.direction === "outbound",
  }
}
