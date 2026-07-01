import type { Campaign, CreditStatus, Template, ContactList } from '../context/CampanhasTypes'

export type CreateCampaignData = {
  name: string
  templateId: string
  contactListId?: string
  cdpSegmentSlug?: string
  scheduledAt?: string
}

export type UpdateCampaignData = {
  name?: string
  templateId?: string
  contactListId?: string
  cdpSegmentSlug?: string
  scheduledAt?: string | null
}

export type ListCampaignsResult = {
  campaigns: Campaign[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SendResult = { sent: number; failed: number; total: number }

export interface ICampanhasService {
  list(supabaseId: string, teamId: string | null | undefined, page: number, pageSize: number, status?: string): Promise<ListCampaignsResult>
  create(supabaseId: string, teamId: string | null | undefined, data: CreateCampaignData): Promise<Campaign>
  update(supabaseId: string, teamId: string | null | undefined, id: string, data: UpdateCampaignData): Promise<Campaign>
  send(supabaseId: string, teamId: string | null | undefined, id: string): Promise<SendResult>
  cancel(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  getCreditStatus(supabaseId: string, teamId: string | null | undefined): Promise<CreditStatus>
  getTemplates(supabaseId: string, teamId: string | null | undefined): Promise<Template[]>
  getContactLists(supabaseId: string, teamId: string | null | undefined): Promise<ContactList[]>
}
