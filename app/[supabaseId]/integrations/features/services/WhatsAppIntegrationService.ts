import type { IWhatsAppIntegrationService, WhatsAppConfig, WhatsAppUsage } from './IWhatsAppIntegrationService'

class WhatsAppIntegrationService implements IWhatsAppIntegrationService {
  private buildHeaders(supabaseId: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-supabase-user-id': supabaseId,
    }
  }

  private extractErrorMessage(output: Record<string, unknown> | null, fallback: string): string {
    if (!output) return fallback
    const errors = Array.isArray(output.errorMessages) ? output.errorMessages : []
    if (errors.length > 0) {
      return (errors as string[]).join(', ')
    }
    return fallback
  }

  async fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/config`, {
      method: 'GET',
      headers: this.buildHeaders(supabaseId),
    })

    if (response.status === 404) {
      return null
    }

    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar a configuração do WhatsApp'))
    }

    return output.result as WhatsAppConfig
  }

  async createConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig> {
    const response = await fetch(`/api/v1/teams/${teamId}/whatsapp/config`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId),
      body: JSON.stringify({}),
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
      headers: this.buildHeaders(supabaseId),
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
      headers: this.buildHeaders(supabaseId),
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
      headers: this.buildHeaders(supabaseId),
    })

    if (response.status === 404) {
      return null
    }

    const output = await response.json() as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar o uso do WhatsApp'))
    }

    return output.result as WhatsAppUsage
  }
}

export const whatsAppIntegrationService = new WhatsAppIntegrationService()
