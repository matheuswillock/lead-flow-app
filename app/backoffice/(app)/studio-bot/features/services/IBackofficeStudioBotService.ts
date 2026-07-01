import type {
  BackofficeStudioBotAuthChallenge,
  BackofficeStudioBotAuthChallengeFilters,
  BackofficeStudioBotChannel,
  BackofficeStudioBotChannelFormData,
  BackofficeStudioBotConversationItem,
  BackofficeStudioBotConversationsFilters,
  BackofficeStudioBotMessage,
  BackofficeStudioBotPagination,
  BackofficeStudioBotProfileFormData,
  BackofficeStudioBotUserLink,
} from "../context/BackofficeStudioBotTypes"

export interface ApiOutput<T = unknown> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

export interface IBackofficeStudioBotService {
  getChannel(): Promise<BackofficeStudioBotChannel | null>
  updateChannel(form: BackofficeStudioBotChannelFormData): Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  updateChannelProfile(
    form: BackofficeStudioBotProfileFormData
  ): Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  testPing(): Promise<ApiOutput<{ status: number; ok: boolean }>>
  uploadChannelAvatar(file: File): Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  reconnectChannel(): Promise<ApiOutput<{ channel: BackofficeStudioBotChannel; status: number }>>
  syncChannelProfile(): Promise<ApiOutput<{ ok: boolean; status: number }>>
  listConversations(
    filters: BackofficeStudioBotConversationsFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeStudioBotConversationItem[]; pagination: BackofficeStudioBotPagination }>
  listMessages(
    userLinkId: string,
    pagination?: { before?: string; limit?: number }
  ): Promise<{
    userLink: {
      id: string
      profileId: string
      normalizedPhone: string
      profile: {
        id: string
        fullName: string | null
        email: string | null
        profileIconUrl: string | null
      }
    }
    messages: BackofficeStudioBotMessage[]
  }>
  listUserLinks(
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeStudioBotUserLink[]; pagination: BackofficeStudioBotPagination }>
  revokeUserLink(userLinkId: string): Promise<ApiOutput<{ userLinkId: string }>>
  listAuthChallenges(
    filters: BackofficeStudioBotAuthChallengeFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeStudioBotAuthChallenge[]; pagination: BackofficeStudioBotPagination }>
}
