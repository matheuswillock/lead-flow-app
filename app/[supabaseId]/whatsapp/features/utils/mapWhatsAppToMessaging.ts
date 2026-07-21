import type { MessagingConversation, MessagingMessage } from "@/components/messaging/types"
import type { WhatsAppConversation, WhatsAppMessage } from "../context/WhatsAppInboxTypes"
import { getConversationDisplayName } from "./whatsappDisplay"

export function mapWhatsAppConversationToMessaging(
  conversation: WhatsAppConversation
): MessagingConversation {
  return {
    id: conversation.id,
    displayName: getConversationDisplayName({
      contactName: conversation.contactName,
      contactPhone: conversation.contactPhone,
      externalChatId: conversation.externalChatId,
    }),
    subtitle: conversation.contactPhone,
    avatarUrl: conversation.contactAvatarUrl,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadCount: conversation.unreadCount,
  }
}

export function mapWhatsAppMessageToMessaging(message: WhatsAppMessage): MessagingMessage {
  return {
    id: message.id,
    direction: message.direction,
    messageType: message.messageType,
    status: message.status,
    contentText: message.contentText,
    caption: message.caption,
    mediaFileName: message.mediaFileName,
    mediaUrl: message.mediaUrl,
    linkPreview: message.linkPreview,
    senderDisplayName: message.senderDisplayName,
    sentByProfileId: message.sentByProfileId,
    sentAt: message.sentAt,
    createdAt: message.createdAt,
    isAutoResponse: message.isAutoResponse,
  }
}
