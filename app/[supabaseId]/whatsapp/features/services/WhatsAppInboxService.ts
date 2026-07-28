import type { IWhatsAppInboxService } from './IWhatsAppInboxService'
import type { LeadSearchResult, SendMessageMediaInput, WhatsAppConfig, WhatsAppConversation, WhatsAppConversationTag, WhatsAppForwardMessageResult, WhatsAppInboxSearchResult, WhatsAppMessage, WhatsAppMessageActionPayload, WhatsAppMessageActionsState, TeamMember, WhatsAppTeamContact } from '../context/WhatsAppInboxTypes'

export class WhatsAppApiError extends Error {
  readonly code: string | null
  readonly status: number

  constructor(message: string, code: string | null = null, status = 400) {
    super(message)
    this.name = 'WhatsAppApiError'
    this.code = code
    this.status = status
  }
}

class WhatsAppInboxService implements IWhatsAppInboxService {
  private async parseJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error('Resposta inválida do servidor')
    }
    return response.json()
  }

  private extractErrorMessage(output: unknown, fallback: string): string {
    if (!output || typeof output !== 'object') return fallback
    const out = output as Record<string, unknown>
    const errors = Array.isArray(out.errorMessages) ? (out.errorMessages as string[]) : []
    if (errors.length > 0) {
      return errors.join(', ')
    }
    return fallback
  }

  private extractErrorCode(output: unknown): string | null {
    if (!output || typeof output !== 'object') return null
    const result = (output as Record<string, unknown>).result
    if (!result || typeof result !== 'object') return null
    const code = (result as Record<string, unknown>).code
    return typeof code === 'string' ? code : null
  }

  private throwIfInvalid(response: Response, output: unknown, fallback: string): void {
    if (response.ok && (output as Record<string, unknown>)?.isValid) return
    throw new WhatsAppApiError(
      this.extractErrorMessage(output, fallback),
      this.extractErrorCode(output),
      response.status
    )
  }

  private authHeaders(teamId: string, supabaseId: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-supabase-user-id': supabaseId,
      'x-team-id': teamId,
    }
  }

  async fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null> {
    const response = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/config`, {
      method: 'GET',
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    })

    if (response.status === 404) {
      return null
    }

    const output: unknown = await this.parseJsonResponse(response)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar a configuração do WhatsApp'))
    }

    return ((output as Record<string, unknown>).result as WhatsAppConfig) ?? null
  }

  async fetchConversations(
    teamId: string,
    supabaseId: string,
    params: { page?: number; limit?: number; search?: string; hasUnread?: boolean; assignedProfileId?: string; leadId?: string; isArchived?: boolean; tagIds?: string[] }
  ): Promise<{ conversations: WhatsAppConversation[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params.page !== undefined) searchParams.set('page', String(params.page))
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
    if (params.search) searchParams.set('search', params.search)
    if (params.hasUnread !== undefined) searchParams.set('hasUnread', String(params.hasUnread))
    if (params.assignedProfileId) searchParams.set('assignedProfileId', params.assignedProfileId)
    if (params.leadId) searchParams.set('leadId', params.leadId)
    if (params.isArchived !== undefined) searchParams.set('isArchived', String(params.isArchived))
    if (params.tagIds && params.tagIds.length > 0) searchParams.set('tagIds', params.tagIds.join(','))

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )

    const output: unknown = await this.parseJsonResponse(response)
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
    searchParams.set('conversationId', conversationId)
    if (params.page !== undefined) searchParams.set('page', String(params.page))
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit))

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/messages?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )

    const output: unknown = await this.parseJsonResponse(response)
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
    clientMessageId: string,
    text: string,
    media?: SendMessageMediaInput,
    mentionedJids?: string[],
    retryFailed?: boolean,
    quotedMessageId?: string
  ): Promise<{ messageId: string; status: WhatsAppMessage['status'] }> {
    const body: Record<string, unknown> = media
      ? {
          conversationId,
          media: {
            ...media,
            caption: media.caption ?? (text.trim() || undefined),
          },
        }
      : { conversationId, clientMessageId, contentText: text }
    if (media) body.clientMessageId = clientMessageId
    if (mentionedJids && mentionedJids.length > 0) {
      body.mentionedJids = mentionedJids
    }
    if (retryFailed) {
      body.retryFailed = true
    }
    if (quotedMessageId) {
      body.quotedMessageId = quotedMessageId
    }

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/messages`,
      {
        method: 'POST',
        headers: this.authHeaders(teamId, supabaseId),
        body: JSON.stringify(body),
      }
    )

    const output: unknown = await this.parseJsonResponse(response)
    this.throwIfInvalid(response, output, 'Não foi possível enviar a mensagem')

    return (output as Record<string, unknown>).result as { messageId: string; status: WhatsAppMessage['status'] }
  }

  async fetchMessageActionsState(
    teamId: string,
    supabaseId: string,
    messageId: string
  ): Promise<WhatsAppMessageActionsState> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/messages/${encodeURIComponent(messageId)}/actions-state`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )
    const output: unknown = await this.parseJsonResponse(response)
    this.throwIfInvalid(response, output, 'Não foi possível carregar as ações da mensagem')
    return (output as Record<string, unknown>).result as WhatsAppMessageActionsState
  }

  async postMessageAction(
    teamId: string,
    supabaseId: string,
    messageId: string,
    clientActionId: string,
    action: WhatsAppMessageActionPayload
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/messages/${encodeURIComponent(messageId)}/actions`,
      {
        method: 'POST',
        headers: this.authHeaders(teamId, supabaseId),
        body: JSON.stringify({ clientActionId, action }),
      }
    )
    const output: unknown = await this.parseJsonResponse(response)
    this.throwIfInvalid(response, output, 'Não foi possível aplicar a ação')
  }

  async forwardMessage(
    teamId: string,
    supabaseId: string,
    messageId: string,
    destinations: Array<{ conversationId: string; clientMessageId: string }>
  ): Promise<WhatsAppForwardMessageResult> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/messages/${encodeURIComponent(messageId)}/forward`,
      {
        method: 'POST',
        headers: this.authHeaders(teamId, supabaseId),
        body: JSON.stringify({ destinations }),
      }
    )
    const output: unknown = await this.parseJsonResponse(response)
    const result = (output as Record<string, unknown>).result as WhatsAppForwardMessageResult | null
    if (result?.results?.length) {
      if (response.ok && (output as Record<string, unknown>)?.isValid) {
        return result
      }
      const allFailed = result.results.every((item) => !item.ok)
      if (!allFailed) {
        return result
      }
    }
    this.throwIfInvalid(response, output, 'Não foi possível encaminhar a mensagem')
    return result ?? { sourceMessageId: messageId, results: [] }
  }

  async searchConversationMessages(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    query: string,
    signal?: AbortSignal
  ): Promise<{ messages: WhatsAppMessage[]; total: number }> {
    const searchParams = new URLSearchParams({ q: query })
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages/search?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        signal,
      }
    )
    const output: unknown = await this.parseJsonResponse(response)
    this.throwIfInvalid(response, output, 'Não foi possível buscar nesta conversa')
    const result = (output as Record<string, unknown>).result as {
      messages?: WhatsAppMessage[]
      total?: number
    }
    return { messages: result.messages ?? [], total: result.total ?? 0 }
  }

  async fetchContacts(
    teamId: string,
    supabaseId: string,
    params?: { q?: string; groupJid?: string }
  ): Promise<WhatsAppTeamContact[]> {
    const searchParams = new URLSearchParams()
    if (params?.q) searchParams.set('q', params.q)
    if (params?.groupJid) searchParams.set('groupJid', params.groupJid)

    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/contacts?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar os contatos'))
    }

    const result = (output as Record<string, unknown>).result as { contacts: WhatsAppTeamContact[] }
    return result.contacts ?? []
  }

  async searchInbox(teamId: string, supabaseId: string, query: string, signal?: AbortSignal): Promise<WhatsAppInboxSearchResult> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/search?q=${encodeURIComponent(query)}`,
      { headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId }, signal }
    )
    const output = await this.parseJsonResponse(response)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível buscar contatos e conversas'))
    }
    return (output as Record<string, unknown>).result as WhatsAppInboxSearchResult
  }

  async syncPhoneContacts(
    teamId: string,
    supabaseId: string,
    conversationId?: string
  ): Promise<{ imported: number; updatedConversations: number; totalContacts: number }> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/sync-contacts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify(conversationId ? { conversationId } : {}),
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível sincronizar os contatos'))
    }

    return (
      ((output as Record<string, unknown>).result as {
        imported: number
        updatedConversations: number
        totalContacts: number
      }) ?? { imported: 0, updatedConversations: 0, totalContacts: 0 }
    )
  }

  async syncGroupParticipants(
    teamId: string,
    supabaseId: string,
    conversationId: string
  ): Promise<{ imported: number; totalParticipants: number }> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/sync-group-participants`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ conversationId }),
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(
        this.extractErrorMessage(output, 'Não foi possível sincronizar os participantes do grupo')
      )
    }

    return (
      ((output as Record<string, unknown>).result as {
        imported: number
        totalParticipants: number
      }) ?? { imported: 0, totalParticipants: 0 }
    )
  }

  async markConversationRead(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversation-read`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ conversationId }),
      }
    )

    const output: unknown = await this.parseJsonResponse(response).catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
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
          'x-team-id': teamId,
        },
        body: JSON.stringify({ profileId }),
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível atribuir o responsável'))
    }
  }

  async takeoverConversation(
    teamId: string,
    supabaseId: string,
    conversationId: string
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/takeover`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível assumir a conversa'))
    }
  }

  async setHandoffMode(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    mode: 'BOT' | 'HUMAN'
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/handoff`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ mode }),
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível alterar o modo de atendimento'))
    }
  }

  async fetchTeamMembers(teamId: string, supabaseId: string): Promise<TeamMember[]> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/members`,
      {
        method: 'GET',
        headers: {
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar os membros do time'))
    }

    const result = (output as Record<string, unknown>).result
    const members = Array.isArray(result)
      ? result
      : ((result as Record<string, unknown> | undefined)?.members ?? [])
    if (!Array.isArray(members)) return []

    return (members as Array<Record<string, unknown>>).map((member) => ({
      id: (member.profileId ?? member.id) as string,
      name: (member.name ?? member.fullName ?? 'Usuário') as string,
      role: (member.role ?? '') as string,
      functions: (Array.isArray(member.functions) ? member.functions : []) as string[],
    }))
  }

  async linkLead(teamId: string, supabaseId: string, conversationId: string, leadId: string): Promise<WhatsAppConversation | null> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/link-lead`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ leadId }),
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível vincular o lead'))
    }

    const result = (output as Record<string, unknown>).result
    return result && typeof result === 'object' ? (result as WhatsAppConversation) : null
  }

  async createLeadFromConversation(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    input: { name: string; phone: string }
  ): Promise<{ leadId: string }> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/create-lead`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify(input),
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível criar o lead'))
    }

    const result = (output as Record<string, unknown>).result as { leadId?: string } | undefined
    if (!result?.leadId) {
      throw new Error('Resposta inválida ao criar lead')
    }

    return { leadId: result.leadId }
  }

  async archiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/archive`,
      {
        method: 'POST',
        headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId },
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível arquivar a conversa'))
    }
  }

  async unarchiveConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/unarchive`,
      {
        method: 'POST',
        headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId },
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível desarquivar a conversa'))
    }
  }

  async deleteConversation(teamId: string, supabaseId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId },
      }
    )

    if (!response.ok && response.status !== 204) {
      const output: unknown = await response.json().catch(() => null)
      throw new Error(this.extractErrorMessage(output, 'Não foi possível excluir a conversa'))
    }
  }

  async updateConversationContactName(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    contactName: string
  ): Promise<WhatsAppConversation> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ contactName }),
      }
    )

    const output: unknown = await response.json().catch(() => null)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível atualizar o nome do contato'))
    }

    return (output as Record<string, unknown>).result as WhatsAppConversation
  }

  async createConversation(
    teamId: string,
    supabaseId: string,
    input: { phone?: string; contactName?: string; contactId?: string }
  ): Promise<WhatsAppConversation> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify(input),
      }
    )

    const output: unknown = await response.json()
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível criar a conversa'))
    }

    return (output as Record<string, unknown>).result as WhatsAppConversation
  }

  async searchLeads(
    teamId: string,
    supabaseId: string,
    query: string,
    role: string
  ): Promise<LeadSearchResult[]> {
    const params = new URLSearchParams({ search: query, teamId, limit: '10', role })
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

  async fetchTags(teamId: string, supabaseId: string): Promise<WhatsAppConversationTag[]> {
    const response = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/tags`, {
      method: 'GET',
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    })

    const output: unknown = await this.parseJsonResponse(response)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar as tags'))
    }

    const result = (output as Record<string, unknown>).result as { tags?: WhatsAppConversationTag[] }
    return result.tags ?? []
  }

  async setConversationTags(
    teamId: string,
    supabaseId: string,
    conversationId: string,
    tagIds: string[]
  ): Promise<WhatsAppConversationTag[]> {
    const response = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations/${encodeURIComponent(conversationId)}/tags`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': teamId,
        },
        body: JSON.stringify({ tagIds }),
      }
    )

    const output: unknown = await this.parseJsonResponse(response)
    if (!response.ok || !(output as Record<string, unknown>)?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível atualizar as tags da conversa'))
    }

    const result = (output as Record<string, unknown>).result as { tags?: WhatsAppConversationTag[] }
    return result.tags ?? []
  }
}

export const whatsAppInboxService = new WhatsAppInboxService()
