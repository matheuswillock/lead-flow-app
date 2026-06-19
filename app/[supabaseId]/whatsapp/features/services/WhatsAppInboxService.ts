import type { IWhatsAppInboxService } from './IWhatsAppInboxService'
import type { LeadSearchResult, WhatsAppConfig, WhatsAppConversation, WhatsAppMessage, TeamMember } from '../context/WhatsAppInboxTypes'

class WhatsAppInboxService implements IWhatsAppInboxService {
  private extractErrorMessage(output: unknown, fallback: string): string {
    if (!output || typeof output !== 'object') return fallback
    const out = output as Record<string, unknown>
    const errors = Array.isArray(out.errorMessages) ? (out.errorMessages as string[]) : []
    if (errors.length > 0) {
      return errors.join(', ')
    }
    return fallback
  }

  async fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null> {
    const response = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/config`, {
      method: 'GET',
      headers: {
        'x-supabase-user-id': supabaseId,
      },
    })

    if (response.status === 404) {
      return null
    }

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar a configuração do WhatsApp'))
    }

    return ((output as Record<string, unknown>).result as WhatsAppConfig) ?? null
  }

  async fetchConversations(
    teamId: string,
    supabaseId: string,
    params: { page?: number; limit?: number; search?: string; hasUnread?: boolean; assignedProfileId?: string; leadId?: string }
  ): Promise<{ conversations: WhatsAppConversation[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params.page !== undefined) searchParams.set('page', String(params.page))
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
    if (params.search) searchParams.set('search', params.search)
    if (params.hasUnread !== undefined) searchParams.set('hasUnread', String(params.hasUnread))
    if (params.assignedProfileId) searchParams.set('assignedProfileId', params.assignedProfileId)
    if (params.leadId) searchParams.set('leadId', params.leadId)

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar as conversas'))
    }

    const result = (output as Record<string, unknown>).result as {
      conversations: WhatsAppConversation[]
      total: number
    }
    return { conversations: result.conversations ?? [], total: result.total ?? 0 }
  }

  async fetchMessages(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    params: { page?: number; limit?: number }
  ): Promise<{ messages: WhatsAppMessage[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params.page !== undefined) searchParams.set('page', String(params.page))
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit))

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar as mensagens'))
    }

    const result = (output as Record<string, unknown>).result as {
      messages: WhatsAppMessage[]
      total: number
    }
    return { messages: result.messages ?? [], total: result.total ?? 0 }
  }

  async sendMessage(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    text: string
  ): Promise<{ messageId: string }> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
        },
        body: JSON.stringify({ contentText: text }),
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível enviar a mensagem'))
    }

    return (output as Record<string, unknown>).result as { messageId: string }
  }

  async markConversationRead(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/read`,
      {
        method: 'POST',
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      }
    )

    if (!response.ok) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível marcar a conversa como lida'))
    }
  }

  async assignConversation(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    profileId: string
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/assign`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
        },
        body: JSON.stringify({ profileId }),
      }
    )

    if (!response.ok) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível atribuir o responsável'))
    }
  }

  async fetchTeamMembers(teamId: string, supabaseId: string): Promise<TeamMember[]> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/members`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar os membros do time'))
    }

    const result = (output as Record<string, unknown>).result as Array<Record<string, unknown>>
    if (!Array.isArray(result)) return []

    return result.map((member) => ({
      id: (member.profileId ?? member.id) as string,
      name: (member.name ?? member.fullName ?? 'Usuário') as string,
      role: (member.role ?? '') as string,
      functions: (Array.isArray(member.functions) ? member.functions : []) as string[],
    }))
  }

  async linkLead(teamId: string, supabaseId: string, conversationId: string, leadId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/link-lead`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
        },
        body: JSON.stringify({ leadId }),
      }
    )

    if (!response.ok) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível vincular o lead'))
    }
  }

  async archiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/archive`,
      {
        method: 'POST',
        headers: { 'x-supabase-user-id': supabaseId },
      }
    )

    if (!response.ok) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível arquivar a conversa'))
    }
  }

  async unarchiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/unarchive`,
      {
        method: 'POST',
        headers: { 'x-supabase-user-id': supabaseId },
      }
    )

    if (!response.ok) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível desarquivar a conversa'))
    }
  }

  async deleteConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: { 'x-supabase-user-id': supabaseId },
      }
    )

    if (!response.ok && response.status !== 204) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível excluir a conversa'))
    }
  }

  async searchLeads(teamId: string, supabaseId: string, query: string): Promise<LeadSearchResult[]> {
    const params = new URLSearchParams({ search: query, teamId, limit: '10' })
    const response = await fetch(`/api/v1/leads?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    })

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível buscar leads'))
    }

    const result = (output as Record<string, unknown>).result
    const leads = Array.isArray(result) ? result : ((result as Record<string, unknown>)?.leads ?? [])
    if (!Array.isArray(leads)) return []

    return (leads as Array<Record<string, unknown>>).map((lead) => ({
      id: lead.id as string,
      name: (lead.name ?? 'Sem nome') as string,
      phone: (lead.phone ?? null) as string | null,
      email: (lead.email ?? null) as string | null,
      leadCode: (lead.leadCode ?? '') as string,
    }))
  }
}

export const whatsAppInboxService = new WhatsAppInboxService()
