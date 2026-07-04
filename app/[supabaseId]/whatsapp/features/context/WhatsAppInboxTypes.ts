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

export interface WhatsAppTeamContact {
  id: string
  remoteJid: string
  opaqueId: string
  phoneNumber: string | null
  displayName: string | null
  pushName: string | null
  source: string
}

export type WhatsAppContactLookup = Record<string, string>

export interface WhatsAppConversation {
  id: string
  teamId: string
  configId: string
  leadId: string | null
  externalChatId: string | null
  contactPhone: string
  contactName: string | null
  contactAvatarUrl: string | null
  normalizedPhone: string
  assignedProfileId: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
  handoffMode: 'BOT' | 'HUMAN'
  welcomeSentAt: string | null
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
  senderDisplayName: string | null
  mediaFileName: string | null
  linkPreview: { title?: string; description?: string; imageUrl?: string; url?: string } | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  isAutoResponse: boolean
  createdAt: string
}

export type WhatsAppConnectionStatus = 'PENDING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'BANNED'

export type WhatsAppHistorySyncStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface WhatsAppConfig {
  status: WhatsAppConnectionStatus
  phoneNumber: string | null
  instanceName: string
  historySyncStatus?: WhatsAppHistorySyncStatus
  historySyncStartedAt?: string | null
  historySyncCompletedAt?: string | null
  historySyncError?: string | null
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
  isChangingHandoff: boolean
  isLinkingLead: boolean
  isArchiving: boolean
  isDeleting: boolean
  teamMembers: TeamMember[]
  isLoadingTeamMembers: boolean
  currentProfileId: string | null
  activeTeamId: string | null
  canManageAssignment: boolean
  isCreatingConversation: boolean
  isSyncingContacts: boolean
  isSyncingGroupParticipants: boolean
  isLoadingContacts: boolean
  contacts: WhatsAppTeamContact[]
  contactLookup: WhatsAppContactLookup
  isTeamMaster: boolean
  unreadTotal: number
  allUnreadTotal: number
  mineUnreadTotal: number
}

export interface SendMessageMediaInput {
  mediatype: 'image' | 'document' | 'audio' | 'video'
  mimeType: string
  fileName: string
  base64: string
  caption?: string
}

export interface InboxActions {
  selectConversation: (id: string) => void
  loadMoreConversations: () => void
  loadOlderMessages: () => void
  sendMessage: (text: string, media?: SendMessageMediaInput, mentionedJids?: string[]) => void
  resendMessage: (messageId: string) => void
  setSearchQuery: (q: string) => void
  setFilterMode: (mode: ConversationFilterMode) => void
  assignConversation: (conversationId: string, profileId: string) => void
  takeoverConversation: (conversationId: string) => void
  setHandoffMode: (conversationId: string, mode: 'BOT' | 'HUMAN') => void
  loadTeamMembers: () => void
  linkLead: (conversationId: string, leadId: string) => void
  searchLeads: (query: string) => Promise<LeadSearchResult[]>
  archiveConversation: (conversationId: string) => void
  unarchiveConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void
  createConversation: (input: {
    phone: string
    contactName?: string
    initialMessage?: string
  }) => Promise<WhatsAppConversation | void>
  syncPhoneContacts: (
    conversationId?: string
  ) => Promise<{ imported: number; updatedConversations: number; totalContacts: number }>
  syncGroupParticipants: (conversationId: string) => Promise<{ imported: number; totalParticipants: number }>
  loadContacts: (groupJid?: string) => Promise<void>
}

