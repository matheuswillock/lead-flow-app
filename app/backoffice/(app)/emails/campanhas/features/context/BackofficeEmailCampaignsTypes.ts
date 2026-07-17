export type BackofficeEmailCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "canceled"
  | "failed"

export interface BackofficeEmailCampaignItem {
  id: string
  name: string
  type: "live_weekly"
  status: BackofficeEmailCampaignStatus
  resendTemplateId: string | null
  resendTemplateName: string | null
  contactListId: string
  fromName: string | null
  fromEmail: string | null
  replyTo: string | null
  scheduledAt: string
  sentAt: string | null
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  dispatchCount: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface BackofficeEmailCampaignDispatchItem {
  id: string
  campaignId: string
  dispatchNumber: number
  status: "sending" | "completed" | "failed"
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  errorMessage: string | null
  createdAt: string
}

export interface BackofficeEmailContactListOption {
  id: string
  name: string
  isSystemDefault: boolean
  totalContacts: number
}

export interface BackofficeEmailTemplateOption {
  id: string
  name: string
  status: string
}

export interface CreateBackofficeEmailCampaignFormData {
  name: string
  contactListId: string
  scheduledAt: string
  resendTemplateId?: string
  resendTemplateName?: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
}
