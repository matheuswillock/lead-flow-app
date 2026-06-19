export interface WhatsAppConversation {
  id: string
  teamId: string
  configId: string
  leadId: string | null
  externalChatId: string | null
  contactPhone: string
  contactName: string | null
  normalizedPhone: string
  assignedProfileId: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: string
  status: string
  contentText: string | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  createdAt: string
}

export type WhatsAppConnectionStatus = 'PENDING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'BANNED'

export interface WhatsAppConfig {
  status: WhatsAppConnectionStatus
  phoneNumber: string | null
  instanceName: string
}

export interface InboxState {
  config: WhatsAppConfig | null
  conversations: WhatsAppConversation[]
  selectedConversationId: string | null
  selectedConversation: WhatsAppConversation | null
  messages: WhatsAppMessage[]
  totalConversations: number
  isLoadingConfig: boolean
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  isSending: boolean
  searchQuery: string
  page: number
}

export interface InboxActions {
  selectConversation: (id: string) => void
  loadMoreConversations: () => void
  sendMessage: (text: string) => void
  setSearchQuery: (q: string) => void
}
