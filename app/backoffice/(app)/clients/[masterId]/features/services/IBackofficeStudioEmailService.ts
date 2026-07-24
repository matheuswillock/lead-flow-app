export type StudioEmailCampaign = {
  id: string
  name: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  dispatchCount: number
  createdAt: string
  creator: { fullName: string | null; email: string | null } | null
  template: { id: string; name: string } | null
  contactList: { id: string; name: string } | null
  radarSegmentSlug?: string | null
  errorMessage?: string | null
  managedByCorretorStudio?: boolean
}

export type StudioEmailContactList = {
  id: string
  name: string
  description: string | null
  totalContacts: number
  isSystemDefault?: boolean
  isBlocklist?: boolean
  creator: { fullName: string | null; email: string | null } | null
  managedByCorretorStudio?: boolean
}

export type StudioEmailTemplate = {
  id: string
  name: string
  subject: string
  status: string
  approvalStatus?: string
  creator: { fullName: string | null; email: string | null } | null
  managedByCorretorStudio?: boolean
  updatedAt?: string
}

export type StudioEmailAnalytics = {
  period: { from: string; to: string }
  totals: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
  }
  rates: {
    deliverabilityRate: number
    openRate: number
    clickRate: number
    bounceRate: number
  }
}

export type StudioEmailLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string | null
  status: string
  sentAt: string | null
  campaign: { id: string; name: string } | null
}

export interface IBackofficeStudioEmailService {
  listCampaigns(
    masterId: string,
    teamId: string,
    params?: { page?: number; pageSize?: number; name?: string }
  ): Promise<{ campaigns: StudioEmailCampaign[]; total: number }>
  createCampaign(
    masterId: string,
    teamId: string,
    data: {
      name: string
      templateId: string
      contactListId?: string
      radarSegmentSlug?: string
      scheduledAt?: string | null
    }
  ): Promise<StudioEmailCampaign>
  sendCampaign(masterId: string, teamId: string, campaignId: string): Promise<void>
  cancelCampaign(masterId: string, teamId: string, campaignId: string): Promise<void>
  archiveCampaign(masterId: string, teamId: string, campaignId: string): Promise<void>

  listContactLists(masterId: string, teamId: string): Promise<StudioEmailContactList[]>
  createContactList(
    masterId: string,
    teamId: string,
    data: { name: string; description?: string }
  ): Promise<StudioEmailContactList>
  deleteContactList(masterId: string, teamId: string, listId: string): Promise<void>

  listTemplates(masterId: string, teamId: string): Promise<StudioEmailTemplate[]>
  createTemplate(
    masterId: string,
    teamId: string,
    data: { name: string; subject: string; html?: string }
  ): Promise<StudioEmailTemplate>

  getAnalytics(masterId: string, teamId: string): Promise<StudioEmailAnalytics>
  listLogs(
    masterId: string,
    teamId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<{ items: StudioEmailLog[]; total: number }>
  getSettings(masterId: string, teamId: string): Promise<Record<string, unknown>>
}
