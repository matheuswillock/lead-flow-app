import type { Campaign, CreditStatus, Template, ContactList, CampaignEmailLog, CampaignLogDetail } from '../context/CampanhasTypes'

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

export type SendResult = {
  campaignId: string
  dispatchId: string
  totalRecipients: number
  status: "sending"
}

export interface ICampanhasService {
  list(supabaseId: string, teamId: string | null | undefined, page: number, pageSize: number, status?: string[], name?: string, createdAtFrom?: string, createdAtTo?: string): Promise<ListCampaignsResult>
  create(supabaseId: string, teamId: string | null | undefined, data: CreateCampaignData): Promise<Campaign>
  update(supabaseId: string, teamId: string | null | undefined, id: string, data: UpdateCampaignData): Promise<Campaign>
  send(supabaseId: string, teamId: string | null | undefined, id: string): Promise<SendResult>
  cancel(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  archive(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  getCreditStatus(supabaseId: string, teamId: string | null | undefined): Promise<CreditStatus>
  getTemplates(supabaseId: string, teamId: string | null | undefined): Promise<Template[]>
  getContactLists(supabaseId: string, teamId: string | null | undefined): Promise<ContactList[]>
  getCampaignLogs(supabaseId: string, teamId: string | null | undefined, campaignId: string, params: { page: number; pageSize: number; search?: string; status?: string[] }): Promise<{ logs: CampaignEmailLog[]; total: number; page: number; pageSize: number; totalPages: number }>
  getCampaignLogDetail(supabaseId: string, teamId: string | null | undefined, logId: string): Promise<CampaignLogDetail>
}
