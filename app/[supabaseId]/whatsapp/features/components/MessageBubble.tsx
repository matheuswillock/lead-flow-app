"use client"

import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"
import { getChatKind } from "../utils/whatsappDisplay"
import { shouldShowOutboundOperatorName } from "../utils/shouldShowOutboundOperatorName"
import { mapWhatsAppMessageToMessaging } from "../utils/mapWhatsAppToMessaging"
import { MessagingMessageBubble } from "@/components/messaging/MessagingMessageBubble"
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer"

interface MessageBubbleProps {
  message: WhatsAppMessage
  previousMessage?: WhatsAppMessage | null
}

export function MessageBubble({ message, previousMessage = null }: MessageBubbleProps) {
  const { resendMessage, teamMembers, selectedConversation, activeTeamId, contactLookup } =
    useWhatsAppInboxContext()

  const isOutbound = message.direction === "OUTBOUND"
  const operatorName =
    isOutbound && message.sentByProfileId
      ? (teamMembers.find((m) => m.id === message.sentByProfileId)?.name ?? "Operador")
      : null

  const isGroupChat =
    getChatKind(selectedConversation?.externalChatId) === "group" && !isOutbound
  const showSenderName = isGroupChat && Boolean(message.senderDisplayName)
  const showOperatorName = shouldShowOutboundOperatorName(message, previousMessage)

  const type = message.messageType.toUpperCase()
  const hasMedia = ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "STICKER", "PTT"].includes(type)
  const mediaProxyUrl =
    activeTeamId && hasMedia && !message.id.startsWith("optimistic-")
      ? `/api/v1/teams/${encodeURIComponent(activeTeamId)}/whatsapp/messages/${encodeURIComponent(message.id)}/media`
      : null

  const mappedPrevious = previousMessage ? mapWhatsAppMessageToMessaging(previousMessage) : null

  return (
    <MessagingMessageBubble
      message={mapWhatsAppMessageToMessaging(message)}
      previousMessage={mappedPrevious}
      contactLookup={contactLookup}
      mediaUrl={mediaProxyUrl}
      operatorDisplayName={operatorName}
      showSenderName={showSenderName}
      showOperatorName={showOperatorName}
      onResend={resendMessage}
      renderAudio={(src, variant) => (
        <WhatsAppAudioPlayer src={src} variant={variant} />
      )}
    />
  )
}
