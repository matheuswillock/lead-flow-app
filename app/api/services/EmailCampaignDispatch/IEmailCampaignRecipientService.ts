import type { EmailTemplateVariableDefinition } from "@/lib/email/interpolate"

export type CampaignRecipient = {
  contactId?: string | null
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export type CampaignDispatchInput = {
  recipients: CampaignRecipient[]
  globalDefaults: Record<string, string>
  templateVariables: EmailTemplateVariableDefinition[]
  subject: string
  html: string
  from: string
  replyTo: string | null
}

export interface IEmailCampaignRecipientService {
  listActiveRecipients(teamId: string, contactListId: string): Promise<CampaignRecipient[]>
  getGlobalDefaults(teamId: string): Promise<Record<string, string>>
  parseTemplateVariables(variables: unknown): EmailTemplateVariableDefinition[]
  buildCampaignDispatchInput(params: {
    teamId: string
    contactListId?: string | null
    cdpSegmentSlug?: string | null
    template: { subject: string; html: string; variables: unknown }
    teamSettings: {
      fromName?: string | null
      fromEmail?: string | null
      replyTo?: string | null
    } | null
    masterTimezone?: string | null
    fallbackFromName: string
    fallbackFromEmail: string
  }): Promise<CampaignDispatchInput>
  findUnresolvedTokensForRecipients(params: {
    subject: string
    html: string
    recipients: CampaignRecipient[]
    globalDefaults: Record<string, string>
    templateVariables: EmailTemplateVariableDefinition[]
  }): string[]
}
