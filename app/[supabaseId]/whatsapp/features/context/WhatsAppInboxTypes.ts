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

export interface WhatsAppInboxSearchContact {
  id: string
  name: string | null
  phoneE164: string | null
  formattedPhone: string | null
  syncState: 'FRESH' | 'STALE' | 'UNRESOLVED' | 'CONFLICT'
  existingConversationId: string | null
  isProvisional: boolean
}

export interface WhatsAppInboxSearchResult {
  conversations: WhatsAppConversation[]
  contacts: WhatsAppInboxSearchContact[]
  startNumber: { normalizedPhone: string; displayPhone: string } | null
}

export type WhatsAppContactLookup = Record<string, string>

export type WhatsAppContactNameSource = 'MANUAL' | 'LEAD' | 'PHONE_BOOK' | 'PUSH_NAME'

export interface WhatsAppConversationTag {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface WhatsAppConversation {
  id: string
  teamId: string
  configId: string
  leadId: string | null
  externalChatId: string | null
  contactPhone: string
  contactName: string | null
  contactNameSource: WhatsAppContactNameSource
  contactAvatarUrl: string | null
  normalizedPhone: string
  assignedProfileId: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
  handoffMode: 'BOT' | 'HUMAN'
  welcomeSentAt: string | null
  tags?: WhatsAppConversationTag[]
  createdAt: string
  updatedAt: string
}

export type WhatsAppMessageStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'PLAYED'
  | 'UNKNOWN'
  | 'FAILED'
  | 'RECEIVED'

export interface WhatsAppMessage {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: string
  status: WhatsAppMessageStatus | string
  /** Idempotency key for outbound intents; null for inbound / legacy rows. */
  clientMessageId: string | null
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
  playedAt?: string | null
  failedAt: string | null
  isAutoResponse: boolean
  createdAt: string
}

export type WhatsAppConnectionStatus = 'PENDING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'BANNED'

export type WhatsAppHistorySyncStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface WhatsAppConfig {
  status: WhatsAppConnectionStatus
  phoneNumber: string | null
  normalizedPhone?: string | null
  lastConnectedNormalizedPhone?: string | null
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
  filterTagIds: string[]
  teamTags: WhatsAppConversationTag[]
  isLoadingTags: boolean
  isUpdatingTags: boolean
  page: number
  hasMoreConversations: boolean
  isAssigning: boolean
  isChangingHandoff: boolean
  isLinkingLead: boolean
  isCreatingLead: boolean
  isUpdatingContactName: boolean
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
  selectConversation: (id: string | null) => void
  loadMoreConversations: () => void
  loadOlderMessages: () => void
  sendMessage: (text: string, media?: SendMessageMediaInput, mentionedJids?: string[]) => void
  resendMessage: (messageId: string) => void
  setSearchQuery: (q: string) => void
  setFilterMode: (mode: ConversationFilterMode) => void
  setFilterTagIds: (tagIds: string[]) => void
  loadTeamTags: () => void
  setConversationTags: (conversationId: string, tagIds: string[]) => void
  assignConversation: (conversationId: string, profileId: string) => void
  takeoverConversation: (conversationId: string) => void
  setHandoffMode: (conversationId: string, mode: 'BOT' | 'HUMAN') => void
  loadTeamMembers: () => void
  linkLead: (conversationId: string, leadId: string) => void
  createLeadFromConversation: (
    conversationId: string,
    input: { name: string; phone: string }
  ) => Promise<void>
  updateContactName: (conversationId: string, contactName: string) => Promise<void>
  searchLeads: (query: string) => Promise<LeadSearchResult[]>
  archiveConversation: (conversationId: string) => void
  unarchiveConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void
  createConversation: (input: {
    phone?: string
    contactName?: string
    contactId?: string
  }) => Promise<WhatsAppConversation | void>
  syncPhoneContacts: (
    conversationId?: string
  ) => Promise<{ imported: number; updatedConversations: number; totalContacts: number }>
  syncGroupParticipants: (conversationId: string) => Promise<{ imported: number; totalParticipants: number }>
  loadContacts: (groupJid?: string) => Promise<void>
  searchInbox: (query: string, signal?: AbortSignal) => Promise<WhatsAppInboxSearchResult>
}
