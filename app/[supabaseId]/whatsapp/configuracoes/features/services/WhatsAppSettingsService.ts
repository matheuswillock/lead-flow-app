import type { IWhatsAppSettingsService } from './IWhatsAppSettingsService'
import type { WhatsAppConfig, WhatsAppUsage, ReusableWhatsAppNumber, WhatsAppOpsMetrics } from '../context/WhatsAppSettingsTypes'

class WhatsAppSettingsService implements IWhatsAppSettingsService {
  private buildHeaders(supabaseId: string, teamId: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-supabase-user-id': supabaseId,
      'x-team-id': teamId,
    }
  }

  private extractErrorMessage(output: Record<string, unknown> | null, fallback: string): string {
    if (!output) return fallback
    const errors = Array.isArray(output.errorMessages) ? output.errorMessages : []
    return errors.length > 0 ? (errors as string[]).join(', ') : fallback
  }

  async fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/config`, {
      method: 'GET',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    if (response.status === 404) return null
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar a configuração do WhatsApp'))
    }
    return output.result as WhatsAppConfig
  }

  async fetchReusableNumbers(teamId: string, supabaseId: string): Promise<ReusableWhatsAppNumber[]> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/reusable-numbers`, {
      method: 'GET',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    if (response.status === 403) return []
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      return []
    }
    return (output.result as ReusableWhatsAppNumber[]) ?? []
  }

  async createConfig(
    teamId: string,
    supabaseId: string,
    options?: { reuseFromTeamId?: string }
  ): Promise<WhatsAppConfig> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/config`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
      body: JSON.stringify(
        options?.reuseFromTeamId ? { reuseFromTeamId: options.reuseFromTeamId } : {}
      ),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível criar a configuração do WhatsApp'))
    }
    return output.result as WhatsAppConfig
  }

  async reconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/reconnect`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível reconectar o WhatsApp'))
    }
    return output.result as WhatsAppConfig
  }

  async disconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/disconnect`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível desconectar o WhatsApp'))
    }
    return output.result as WhatsAppConfig
  }

  async fetchUsage(teamId: string, supabaseId: string): Promise<WhatsAppUsage | null> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/usage`, {
      method: 'GET',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    if (response.status === 404) return null
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar o uso do WhatsApp'))
    }
    return output.result as WhatsAppUsage
  }

  async fetchOpsMetrics(teamId: string, supabaseId: string): Promise<WhatsAppOpsMetrics> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/ops-metrics`, {
      method: 'GET',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar as métricas operacionais'))
    }
    return output.result as WhatsAppOpsMetrics
  }

  async syncHistory(teamId: string, supabaseId: string): Promise<void> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/sync-history`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível sincronizar o histórico do WhatsApp'))
    }
  }

  async syncPhoneContacts(
    teamId: string,
    supabaseId: string
  ): Promise<{ imported: number; updatedConversations: number; totalContacts: number }> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/sync-contacts`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
      body: JSON.stringify({}),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível sincronizar os contatos'))
    }
    return (
      (output.result as {
        imported: number
        updatedConversations: number
        totalContacts: number
      }) ?? { imported: 0, updatedConversations: 0, totalContacts: 0 }
    )
  }

  async purgeConversations(teamId: string, supabaseId: string): Promise<{ deletedCount: number }> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/conversations`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível zerar as conversas'))
    }
    return (output.result as { deletedCount: number }) ?? { deletedCount: 0 }
  }

  async requeueDeadLetterEvents(teamId: string, supabaseId: string): Promise<{ requeuedCount: number }> {
    const response = await fetch(
      `/api/v1/teams/${teamId}/whatsapp/webhook-events/requeue-dead-letter`,
      {
        method: 'POST',
        headers: this.buildHeaders(supabaseId, teamId),
      }
    )
    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível reenfileirar os eventos dead-letter'))
    }
    return (output.result as { requeuedCount: number }) ?? { requeuedCount: 0 }
  }
}

export const whatsAppSettingsService = new WhatsAppSettingsService()
