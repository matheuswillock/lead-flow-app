import { resolveTimezone } from "@/lib/dates"
import {
  applyMasterTimezoneToTemplateVariables,
  findUnresolvedEmailTemplateTokens,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import {
  formatCampaignFromHeader,
  resolveCampaignFrom,
} from "@/lib/email/resolve-campaign-from"
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
import { enrichCampaignRecipientsWithCdp } from "@/lib/cdp/enrich-campaign-recipients"
import { listCdpSegmentEmailRecipients } from "@/lib/cdp/list-segment-recipients"
import { findTeamBlocklistedEmails } from "@/lib/email/email-contact-blocklist"

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
    contactListId?: string | null
    cdpSegmentSlug?: string | null
    template: { subject: string; html: string; variables: unknown }
    teamSettings: {
      fromName?: string | null
      fromEmail?: string | null
      replyTo?: string | null
      resendDomainName?: string | null
    } | null
    defaultSender?: { name: string; email: string } | null
    masterTimezone?: string | null
  }): Promise<CampaignDispatchInput> {
    const baseRecipients = params.cdpSegmentSlug
      ? await listCdpSegmentEmailRecipients(params.teamId, params.cdpSegmentSlug)
      : await this.listActiveRecipients(params.teamId, params.contactListId!)
    const blocklistedEmails = await findTeamBlocklistedEmails(params.teamId)
    const eligibleRecipients =
      blocklistedEmails.size > 0
        ? baseRecipients.filter(
            (recipient) => !blocklistedEmails.has(recipient.email.trim().toLowerCase())
          )
        : baseRecipients
    const enrichedRecipients = await enrichCampaignRecipientsWithCdp(params.teamId, eligibleRecipients)
    const globalDefaults = await this.getGlobalDefaults(params.teamId)
    const parsedVariables = this.parseTemplateVariables(params.template.variables)
    const timezone = resolveTimezone(params.masterTimezone)
    const templateVariables = applyMasterTimezoneToTemplateVariables(parsedVariables, timezone)

    const resolvedFrom = resolveCampaignFrom({
      domainName: params.teamSettings?.resendDomainName,
      defaultSender: params.defaultSender,
      legacyFromName: params.teamSettings?.fromName,
      legacyFromEmail: params.teamSettings?.fromEmail,
    })
    const from = formatCampaignFromHeader(resolvedFrom)
    const replyTo = params.teamSettings?.replyTo ?? null

    return {
      recipients: enrichedRecipients.map((recipient) => ({
        contactId: recipient.contactId ?? null,
        email: recipient.email,
        name: recipient.name ?? null,
        customFields: recipient.customFields ?? null,
      })),
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
