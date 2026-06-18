import type { WhatsAppConfig, WhatsAppConversation, WhatsAppMessage } from '../context/WhatsAppInboxTypes'

export interface IWhatsAppInboxService {
  fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null>
  fetchConversations(
    teamId: string,
    supabaseId: string,
    params: { page?: number; limit?: number; search?: string }
  ): Promise<{ conversations: WhatsAppConversation[]; total: number }>
  fetchMessages(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    params: { page?: number; limit?: number }
  ): Promise<{ messages: WhatsAppMessage[]; total: number }>
  sendMessage(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    text: string
  ): Promise<{ messageId: string }>
}
