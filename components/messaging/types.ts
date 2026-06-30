export type MessagingMessageDirection = "INBOUND" | "OUTBOUND"

export type MessagingMessageStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "RECEIVED"
  | string

export interface MessagingLinkPreview {
  title?: string
  description?: string
  imageUrl?: string
  url?: string
}

export interface MessagingConversation {
  id: string
  displayName: string
  subtitle?: string | null
  avatarUrl?: string | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCount?: number
}

export interface MessagingMessage {
  id: string
  direction: MessagingMessageDirection
  messageType: string
  status?: MessagingMessageStatus
  contentText?: string | null
  caption?: string | null
  mediaFileName?: string | null
  mediaUrl?: string | null
  linkPreview?: MessagingLinkPreview | null
  senderDisplayName?: string | null
  sentByProfileId?: string | null
  sentAt?: string | null
  createdAt: string
  isAutoResponse?: boolean
}

export type MessagingContactLookup = Record<string, string>
