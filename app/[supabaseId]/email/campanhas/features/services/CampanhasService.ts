import type { Campaign, CreditStatus, Template, ContactList } from '../context/CampanhasTypes'

export interface ICampanhasService {
  list(page: number, pageSize: number, status?: string): Promise<{ campaigns: Campaign[]; total: number; page: number; pageSize: number; totalPages: number }>
  create(data: { name: string; templateId: string; contactListId: string; scheduledAt?: string }): Promise<Campaign>
  send(id: string): Promise<{ sent: number; failed: number }>
  cancel(id: string): Promise<void>
  deleteDraft(id: string): Promise<void>
  getCreditStatus(): Promise<CreditStatus>
  getTemplates(): Promise<Template[]>
  getContactLists(): Promise<ContactList[]>
}

export class CampanhasService implements ICampanhasService {
  private readonly baseUrl = '/api/v1/email'

  async list(page: number, pageSize: number, status?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    const res = await fetch(`${this.baseUrl}/campaigns?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as { campaigns: Campaign[]; total: number; page: number; pageSize: number; totalPages: number }
  }

  async create(data: { name: string; templateId: string; contactListId: string; scheduledAt?: string }) {
    const res = await fetch(`${this.baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Campaign
  }

  async send(id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/send`, { method: 'POST' })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json?.isValid) throw new Error(json?.errorMessages?.join(', ') ?? 'Erro')
    return json.result as { sent: number; failed: number }
  }

  async cancel(id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/cancel`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
  }

  async update(id: string, data: { name?: string; templateId?: string; contactListId?: string; scheduledAt?: string | null }) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Campaign
  }

  async deleteDraft(id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  async getCreditStatus() {
    const res = await fetch(`${this.baseUrl}/credits/status`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as CreditStatus
  }

  async getTemplates() {
    const res = await fetch(`${this.baseUrl}/templates?scope=campaign`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    // Only the current published version can be used in new campaigns.
    return ((json.result ?? []) as Template[]).filter((t) => t.status === 'published' && t.isCurrentPublished)
  }

  async getContactLists() {
    const res = await fetch(`${this.baseUrl}/contact-lists`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return (json.result ?? []) as ContactList[]
  }
}
