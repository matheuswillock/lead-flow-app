import type { IWhatsAppAutoResponsesService } from './IWhatsAppAutoResponsesService'
import type {
  OffHoursSchedule,
  WhatsAppAutoResponseMatchMode,
  WhatsAppAutoResponseRule,
} from '../context/WhatsAppAutoResponsesTypes'
import { API_CLIENT_BASE } from "@/lib/route-map";

class WhatsAppAutoResponsesService implements IWhatsAppAutoResponsesService {
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

  async fetchRules(teamId: string, supabaseId: string): Promise<WhatsAppAutoResponseRule[]> {
    const response = await fetch(
      `${API_CLIENT_BASE}/teams/${encodeURIComponent(teamId)}/whatsapp/auto-response-rules`,
      {
        method: 'GET',
        headers: this.buildHeaders(supabaseId, teamId),
      }
    )
    const output = (await response.json()) as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível carregar as regras'))
    }
    const result = output.result as { rules?: WhatsAppAutoResponseRule[] }
    return result.rules ?? []
  }

  async updateRule(
    teamId: string,
    supabaseId: string,
    ruleId: string,
    payload: Partial<{
      replyMessage: string
      triggerKeywords: string[]
      matchMode: WhatsAppAutoResponseMatchMode
      offHoursSchedule: OffHoursSchedule | null
      isActive: boolean
      priority: number
    }>
  ): Promise<WhatsAppAutoResponseRule> {
    const response = await fetch(
      `${API_CLIENT_BASE}/teams/${encodeURIComponent(teamId)}/whatsapp/auto-response-rules/${encodeURIComponent(ruleId)}`,
      {
        method: 'PATCH',
        headers: this.buildHeaders(supabaseId, teamId),
        body: JSON.stringify(payload),
      }
    )
    const output = (await response.json()) as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível salvar a regra'))
    }
    return output.result as WhatsAppAutoResponseRule
  }

  async toggleRule(
    teamId: string,
    supabaseId: string,
    ruleId: string,
    isActive: boolean
  ): Promise<WhatsAppAutoResponseRule> {
    const response = await fetch(
      `${API_CLIENT_BASE}/teams/${encodeURIComponent(teamId)}/whatsapp/auto-response-rules/${encodeURIComponent(ruleId)}/toggle`,
      {
        method: 'POST',
        headers: this.buildHeaders(supabaseId, teamId),
        body: JSON.stringify({ isActive }),
      }
    )
    const output = (await response.json()) as Record<string, unknown>
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, 'Não foi possível alterar o status da regra'))
    }
    return output.result as WhatsAppAutoResponseRule
  }
}

export const whatsAppAutoResponsesService = new WhatsAppAutoResponsesService()
