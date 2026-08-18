import type { RecipientListPage } from "@/app/api/infra/data/repositories/emailCampaignRecipient/IEmailCampaignRecipientRepository"
import type { EmailTemplateVariableDefinition } from "@/lib/email/interpolate"
import type { ResolvedCampaignFrom } from "@/lib/email/resolve-campaign-from"

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
  resolvedFrom: ResolvedCampaignFrom
}

export interface IEmailCampaignRecipientService {
  listActiveRecipients(
    teamId: string,
    contactListId: string,
    page?: RecipientListPage
  ): Promise<CampaignRecipient[]>
  listActiveRecipientsByIds(contactIds: string[]): Promise<CampaignRecipient[]>
  countActiveRecipients(teamId: string, contactListId: string): Promise<number>
  getGlobalDefaults(teamId: string): Promise<Record<string, string>>
  parseTemplateVariables(variables: unknown): EmailTemplateVariableDefinition[]
  buildCampaignDispatchInput(params: {
    teamId: string
    contactListId?: string | null
    radarSegmentSlug?: string | null
    audienceContactIds?: string[] | null
    template: { subject: string; html: string; variables: unknown }
    teamSettings: {
      fromName?: string | null
      fromEmail?: string | null
      replyTo?: string | null
      resendDomainName?: string | null
    } | null
    defaultSender?: { name: string; email: string } | null
    masterTimezone?: string | null
  }): Promise<CampaignDispatchInput>
  findUnresolvedTokensForRecipients(params: {
    subject: string
    html: string
    recipients: CampaignRecipient[]
    globalDefaults: Record<string, string>
    templateVariables: EmailTemplateVariableDefinition[]
  }): string[]
}
