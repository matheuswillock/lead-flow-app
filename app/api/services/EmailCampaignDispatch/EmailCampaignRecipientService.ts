import { resolveTimezone } from "@/lib/dates"
import {
  applyMasterTimezoneToTemplateVariables,
  findUnresolvedEmailTemplateTokens,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import type { CampaignRecipientRecord } from "@/app/api/infra/data/repositories/emailCampaignRecipient/IEmailCampaignRecipientRepository"
import {
  EmailCampaignRecipientRepository,
} from "@/app/api/infra/data/repositories/emailCampaignRecipient/EmailCampaignRecipientRepository"
import type { IEmailCampaignRecipientRepository } from "@/app/api/infra/data/repositories/emailCampaignRecipient/IEmailCampaignRecipientRepository"
import type {
  CampaignDispatchInput,
  CampaignRecipient,
  IEmailCampaignRecipientService,
} from "./IEmailCampaignRecipientService"

export class EmailCampaignRecipientService implements IEmailCampaignRecipientService {
  constructor(
    private readonly repository: IEmailCampaignRecipientRepository = new EmailCampaignRecipientRepository()
  ) {}

  private dedupeRecipients(recipients: CampaignRecipientRecord[]): CampaignRecipient[] {
    const uniqueRecipients = new Map<string, CampaignRecipient>()

    for (const recipient of recipients) {
      const normalizedEmail = recipient.email.trim().toLowerCase()
      if (!uniqueRecipients.has(normalizedEmail)) {
        uniqueRecipients.set(normalizedEmail, {
          ...recipient,
          email: normalizedEmail,
        })
      }
    }

    return Array.from(uniqueRecipients.values())
  }

  async listActiveRecipients(teamId: string, contactListId: string): Promise<CampaignRecipient[]> {
    const contactList = await this.repository.findContactListMeta(teamId, contactListId)

    if (!contactList) {
      return []
    }

    if (contactList.isSystemDefault) {
      const recipients = await this.repository.findActiveRecipientsForTeam(teamId)
      return this.dedupeRecipients(recipients)
    }

    return this.repository.findActiveRecipientsForList(contactListId)
  }

  async getGlobalDefaults(teamId: string): Promise<Record<string, string>> {
    try {
      return await this.repository.findGlobalVariableDefaults(teamId)
    } catch (error) {
      console.error("[EmailCampaignRecipientService][getGlobalDefaults]", error)
      return {}
    }
  }

  parseTemplateVariables(variables: unknown): EmailTemplateVariableDefinition[] {
    return Array.isArray(variables) ? (variables as EmailTemplateVariableDefinition[]) : []
  }

  async buildCampaignDispatchInput(params: {
    teamId: string
    contactListId: string
    template: { subject: string; html: string; variables: unknown }
    teamSettings: {
      fromName?: string | null
      fromEmail?: string | null
      replyTo?: string | null
    } | null
    masterTimezone?: string | null
    fallbackFromName: string
    fallbackFromEmail: string
  }): Promise<CampaignDispatchInput> {
    const recipients = await this.listActiveRecipients(params.teamId, params.contactListId)
    const globalDefaults = await this.getGlobalDefaults(params.teamId)
    const parsedVariables = this.parseTemplateVariables(params.template.variables)
    const timezone = resolveTimezone(params.masterTimezone)
    const templateVariables = applyMasterTimezoneToTemplateVariables(parsedVariables, timezone)

    const fromName = params.teamSettings?.fromName ?? params.fallbackFromName
    const fromEmail = params.teamSettings?.fromEmail ?? params.fallbackFromEmail
    const from = `${fromName} <${fromEmail}>`
    const replyTo = params.teamSettings?.replyTo ?? null

    return {
      recipients,
      globalDefaults,
      templateVariables,
      subject: params.template.subject,
      html: params.template.html,
      from,
      replyTo,
    }
  }

  findUnresolvedTokensForRecipients(params: {
    subject: string
    html: string
    recipients: CampaignRecipient[]
    globalDefaults: Record<string, string>
    templateVariables: EmailTemplateVariableDefinition[]
  }): string[] {
    const unresolved = new Set<string>()

    for (const recipient of params.recipients) {
      const tokens = findUnresolvedEmailTemplateTokens(
        params.subject,
        params.html,
        {
          email: recipient.email,
          name: recipient.name,
          customFields: recipient.customFields,
        },
        params.globalDefaults,
        params.templateVariables
      )
      for (const token of tokens) {
        unresolved.add(token)
      }
    }

    return Array.from(unresolved)
  }
}

export const emailCampaignRecipientService = new EmailCampaignRecipientService()
