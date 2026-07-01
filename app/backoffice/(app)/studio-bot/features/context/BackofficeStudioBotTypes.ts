export type BackofficeBotChannelStatus = "pending" | "connected" | "disconnected" | "error"

export interface BackofficeStudioBotChannel {
  id: string
  displayName: string
  avatarUrl: string | null
  aboutText: string | null
  phoneNumber: string | null
  channelType: string
  status: BackofficeBotChannelStatus
  n8nInboundUrl: string | null
  isActive: boolean
  lastProfileSyncAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BackofficeStudioBotConversationItem {
  userLinkId: string
  profileId: string
  normalizedPhone: string
  linkedAt: string
  lastInteractionAt: string | null
  profileFullName: string | null
  profileEmail: string | null
  profileIconUrl: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastMessageDirection: string | null
}

export interface BackofficeStudioBotMessage {
  id: string
  channelId: string
  userLinkId: string | null
  direction: "inbound" | "outbound"
  channelMessageId: string | null
  flowId: string | null
  errorCode: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface BackofficeStudioBotUserLink {
  id: string
  profileId: string
  normalizedPhone: string
  linkedAt: string
  linkedBy: string
  authChallengeId: string | null
  isActive: boolean
  lastInteractionAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
  profile: {
    id: string
    fullName: string | null
    email: string | null
    profileIconUrl: string | null
    supabaseId: string | null
  }
}

export interface BackofficeStudioBotAuthChallenge {
  id: string
  source: string
  normalizedPhone: string | null
  emailRequested: string | null
  profileId: string | null
  status: string
  attemptCount: number
  expiresAt: string
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BackofficeStudioBotPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BackofficeStudioBotConversationsFilters {
  search: string
}

export interface BackofficeStudioBotAuthChallengeFilters {
  source: string
  status: string
}

export interface BackofficeStudioBotProfileFormData {
  displayName: string
  aboutText: string
}

export interface BackofficeStudioBotChannelFormData {
  displayName?: string
  aboutText?: string | null
  n8nInboundUrl?: string | null
  status?: BackofficeBotChannelStatus
}

export interface BackofficeStudioBotState {
  channel: BackofficeStudioBotChannel | null
  conversations: BackofficeStudioBotConversationItem[]
  conversationsPagination: BackofficeStudioBotPagination
  conversationsFilters: BackofficeStudioBotConversationsFilters
  selectedUserLinkId: string | null
  messages: BackofficeStudioBotMessage[]
  isLoadingChannel: boolean
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  isSavingProfile: boolean
  isTestingPing: boolean
  isUploadingAvatar: boolean
  isReconnecting: boolean
  isSyncingProfile: boolean
  userLinks: BackofficeStudioBotUserLink[]
  userLinksPagination: BackofficeStudioBotPagination
  isLoadingUserLinks: boolean
  isRevokingLink: boolean
  authChallenges: BackofficeStudioBotAuthChallenge[]
  authChallengesPagination: BackofficeStudioBotPagination
  authChallengesFilters: BackofficeStudioBotAuthChallengeFilters
  isLoadingAuthChallenges: boolean
  canManage: boolean
  error: string | null
}

export interface BackofficeStudioBotActions {
  loadChannel: () => Promise<void>
  updateChannelProfile: (form: BackofficeStudioBotProfileFormData) => Promise<boolean>
  updateChannel: (form: BackofficeStudioBotChannelFormData) => Promise<boolean>
  testPing: () => Promise<boolean>
  uploadChannelAvatar: (file: File) => Promise<boolean>
  reconnectChannel: () => Promise<boolean>
  syncChannelProfile: () => Promise<boolean>
  setConversationsFilters: (filters: BackofficeStudioBotConversationsFilters) => void
  setConversationsPage: (page: number) => void
  loadConversations: () => Promise<void>
  selectConversation: (userLinkId: string) => void
  loadMessages: (userLinkId: string) => Promise<void>
  setUserLinksPage: (page: number) => void
  loadUserLinks: () => Promise<void>
  revokeUserLink: (userLinkId: string) => Promise<boolean>
  setAuthChallengesFilters: (filters: BackofficeStudioBotAuthChallengeFilters) => void
  setAuthChallengesPage: (page: number) => void
  loadAuthChallenges: () => Promise<void>
}

export type BackofficeStudioBotContextValue = BackofficeStudioBotState & BackofficeStudioBotActions
