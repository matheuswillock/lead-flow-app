export interface TeamMember {
  id: string
  name: string
  role: string
  functions: string[]
}

export interface LeadSearchResult {
  id: string
  name: string
  phone: string | null
  email: string | null
  leadCode: string
}

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

export type WhatsAppMessageStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RECEIVED'

export interface WhatsAppMessage {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: string
  status: WhatsAppMessageStatus | string
  contentText: string | null
  mediaUrl: string | null
  caption: string | null
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

export type ConversationFilterMode = 'all' | 'unread' | 'mine' | 'archived'

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
  isLoadingOlderMessages: boolean
  hasMoreMessages: boolean
  isSending: boolean
  searchQuery: string
  filterMode: ConversationFilterMode
  page: number
  hasMoreConversations: boolean
  isAssigning: boolean
  isLinkingLead: boolean
  isArchiving: boolean
  isDeleting: boolean
  teamMembers: TeamMember[]
  isLoadingTeamMembers: boolean
  currentProfileId: string | null
  canManageAssignment: boolean
}

export interface InboxActions {
  selectConversation: (id: string) => void
  loadMoreConversations: () => void
  loadOlderMessages: () => void
  sendMessage: (text: string) => void
  resendMessage: (messageId: string) => void
  setSearchQuery: (q: string) => void
  setFilterMode: (mode: ConversationFilterMode) => void
  assignConversation: (conversationId: string, profileId: string) => void
  loadTeamMembers: () => void
  linkLead: (conversationId: string, leadId: string) => void
  searchLeads: (query: string) => Promise<LeadSearchResult[]>
  archiveConversation: (conversationId: string) => void
  unarchiveConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void
}

