import type { Campaign, CreditStatus, Template, ContactList } from '../context/CampanhasTypes'

export type CreateCampaignData = {
  name: string
  templateId: string
  contactListId: string
  scheduledAt?: string
}

export type UpdateCampaignData = {
  name?: string
  templateId?: string
  contactListId?: string
  scheduledAt?: string | null
}

export type ListCampaignsResult = {
  campaigns: Campaign[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SendResult = { sent: number; failed: number }

export interface ICampanhasService {
  list(page: number, pageSize: number, status?: string): Promise<ListCampaignsResult>
  create(data: CreateCampaignData): Promise<Campaign>
  update(id: string, data: UpdateCampaignData): Promise<Campaign>
  send(id: string): Promise<SendResult>
  cancel(id: string): Promise<void>
  deleteDraft(id: string): Promise<void>
  getCreditStatus(): Promise<CreditStatus>
  getTemplates(): Promise<Template[]>
  getContactLists(): Promise<ContactList[]>
}
