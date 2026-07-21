import type { MessagingConversation } from "@/components/messaging/types"
import type { BackofficeStudioBotConversationItem } from "../context/BackofficeStudioBotTypes"
import { maskPhone } from "@/lib/masks"

export function mapUserLinkToConversation(
  item: BackofficeStudioBotConversationItem
): MessagingConversation {
  const displayName =
    item.profileFullName?.trim() || maskPhone(item.normalizedPhone) || item.normalizedPhone

  return {
    id: item.userLinkId,
    displayName,
    subtitle: maskPhone(item.normalizedPhone) || item.normalizedPhone,
    avatarUrl: item.profileIconUrl,
    lastMessageAt: item.lastMessageAt ?? item.lastInteractionAt,
    lastMessagePreview: item.lastMessagePreview,
    unreadCount: 0,
  }
}
