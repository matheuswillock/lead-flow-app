import type {
  DialerCampaign,
  DialerContactsPage,
  UploadContactsResult,
} from '../context/DialerTypes'
import type { CreateDialerCampaignData, IDialerService } from './IDialerService'

type ApiOutput<T> = {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T | null
}

export class DialerService implements IDialerService {
  private readonly baseUrl = '/api/v1/dialer/campaigns'

  private buildHeaders(supabaseId: string, teamId?: string | null): HeadersInit {
    return {
      'x-supabase-user-id': supabaseId,
      ...(teamId ? { 'x-team-id': teamId } : {}),
    }
  }

  private async parseOutput<T>(response: Response, fallbackError: string): Promise<T> {
    const body = (await response.json().catch(() => null)) as ApiOutput<T> | null

    if (!response.ok || !body?.isValid || body.result === null) {
      const message = body?.errorMessages?.join(' ') || `${fallbackError}: ${response.status}`
      console.error('[DialerService]', message)
      throw new Error(message)
    }

    return body.result
  }

  async listCampaigns(supabaseId: string, teamId?: string | null): Promise<DialerCampaign[]> {
    const response = await fetch(this.baseUrl, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const result = await this.parseOutput<{ campaigns: DialerCampaign[] }>(
      response,
      'Erro ao buscar campanhas'
    )
    return result.campaigns
  }

  async createCampaign(
    supabaseId: string,
    data: CreateDialerCampaignData,
    teamId?: string | null
  ): Promise<DialerCampaign> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(supabaseId, teamId),
      },
      body: JSON.stringify(data),
    })
    const result = await this.parseOutput<{ campaign: DialerCampaign }>(
      response,
      'Erro ao criar campanha'
    )
    return result.campaign
  }

  async deleteCampaign(
    supabaseId: string,
    campaignId: string,
    teamId?: string | null
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${campaignId}`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const body = (await response.json().catch(() => null)) as ApiOutput<unknown> | null
    if (!response.ok || !body?.isValid) {
      const message = body?.errorMessages?.join(' ') || `Erro ao excluir campanha: ${response.status}`
      console.error('[DialerService]', message)
      throw new Error(message)
    }
  }

  async listContacts(
    supabaseId: string,
    campaignId: string,
    page: number,
    teamId?: string | null
  ): Promise<DialerContactsPage> {
    const response = await fetch(`${this.baseUrl}/${campaignId}/contacts?page=${page}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseOutput<DialerContactsPage>(response, 'Erro ao buscar contatos')
  }

  async uploadContacts(
    supabaseId: string,
    campaignId: string,
    file: File,
    teamId?: string | null
  ): Promise<UploadContactsResult> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/${campaignId}/contacts/upload`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
      body: formData,
    })
    return this.parseOutput<UploadContactsResult>(response, 'Erro ao enviar contatos')
  }
}

export function createDialerService(): IDialerService {
  return new DialerService()
}
