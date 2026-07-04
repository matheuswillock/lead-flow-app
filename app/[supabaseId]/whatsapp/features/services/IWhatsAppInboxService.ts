import type { LeadSearchResult, SendMessageMediaInput, WhatsAppConfig, WhatsAppConversation, WhatsAppMessage, TeamMember, WhatsAppTeamContact } from '../context/WhatsAppInboxTypes'

export interface IWhatsAppInboxService {
  fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null>
  fetchConversations(
    teamId: string,
    supabaseId: string,
    params: { page?: number; limit?: number; search?: string; hasUnread?: boolean; assignedProfileId?: string; leadId?: string; isArchived?: boolean }
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
    text: string,
    media?: SendMessageMediaInput,
    mentionedJids?: string[]
  ): Promise<{ messageId: string }>
  fetchContacts(
    teamId: string,
    supabaseId: string,
    params?: { q?: string; groupJid?: string }
  ): Promise<WhatsAppTeamContact[]>
  syncPhoneContacts(
    teamId: string,
    supabaseId: string,
    conversationId?: string
  ): Promise<{ imported: number; updatedConversations: number; totalContacts: number }>
  syncGroupParticipants(
    teamId: string,
    supabaseId: string,
    conversationId: string
  ): Promise<{ imported: number; totalParticipants: number }>
  markConversationRead(teamId: string, supabaseId: string, conversationId: string): Promise<void>
  assignConversation(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    profileId: string
  ): Promise<void>
  takeoverConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void>
  setHandoffMode(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    mode: 'BOT' | 'HUMAN'
  ): Promise<void>
  fetchTeamMembers(teamId: string, supabaseId: string): Promise<TeamMember[]>
  linkLead(teamId: string, supabaseId: string, conversationId: string, leadId: string): Promise<WhatsAppConversation | null>
  createLeadFromConversation(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    input: { name: string; phone: string }
  ): Promise<{ leadId: string }>
  searchLeads(teamId: string, supabaseId: string, query: string, role: string): Promise<LeadSearchResult[]>
  archiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void>
  unarchiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void>
  deleteConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void>
  updateConversationContactName(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    contactName: string
  ): Promise<WhatsAppConversation>
  createConversation(
    teamId: string,
    supabaseId: string,
    input: { phone: string; contactName?: string; initialMessage?: string }
  ): Promise<WhatsAppConversation>
}
