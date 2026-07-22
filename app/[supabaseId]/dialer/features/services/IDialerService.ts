import type {
  DialerCampaign,
  DialerContactsPage,
  UploadContactsResult,
} from '../context/DialerTypes'

export interface CreateDialerCampaignData {
  name: string
  description?: string | null
}

export interface IDialerService {
  listCampaigns(supabaseId: string, teamId?: string | null): Promise<DialerCampaign[]>
  createCampaign(
    supabaseId: string,
    data: CreateDialerCampaignData,
    teamId?: string | null
  ): Promise<DialerCampaign>
  deleteCampaign(supabaseId: string, campaignId: string, teamId?: string | null): Promise<void>
  listContacts(
    supabaseId: string,
    campaignId: string,
    page: number,
    teamId?: string | null
  ): Promise<DialerContactsPage>
  uploadContacts(
    supabaseId: string,
    campaignId: string,
    file: File,
    teamId?: string | null
  ): Promise<UploadContactsResult>
}
