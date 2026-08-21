import { Prisma } from "@prisma/client"
import type { Lead } from "@prisma/client"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { findMatchingLead } from "@/app/api/useCases/publicForms/publicFormLeadSync"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { Output } from "@/lib/output"
import {
  extractPhoneFromCustomFields,
  FORM_START_ACTIVITY_BODY,
  parseEmailLogIdFromOrigin,
  resolveAttributionDisplayName,
} from "@/lib/public-forms/email-campaign-attribution"
import { normalizeLeadPhoneDigits } from "@/lib/masks"

export type ResolveEmailCampaignFormAttributionInput = {
  teamId: string
  formId: string
  formName: string
  formPublicId: string
  publicationId: string
  emailCampaignTrackingEnabled: boolean
  eventType: "form_viewed" | "form_started" | "form_completed"
  origin: Record<string, unknown>
  visitorSessionId: string
}

export type ResolveEmailCampaignFormAttributionResult = {
  leadId: string | null
  campaignId: string | null
  emailLogId: string | null
  enrichedOrigin: Record<string, unknown>
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * Resolve `cs_el` → EmailLog → lead CRM existente + atividades de início + identidade Radar.
 * Premissa: EmailLog.id é o PID por destinatário no disparo da campanha.
 * Lead CRM novo nasce no Radar (gate A+C no perfil unificado), não no Progress.
 */
class ResolveEmailCampaignFormAttributionUseCase {
  async execute(input: ResolveEmailCampaignFormAttributionInput): Promise<Output> {
    const emailLogId = parseEmailLogIdFromOrigin(input.origin)
    const enrichedOrigin: Record<string, unknown> = { ...input.origin }

    if (!emailLogId || !input.emailCampaignTrackingEnabled) {
      return new Output(true, [], [], {
        leadId: null,
        campaignId: null,
        emailLogId,
        enrichedOrigin,
      } satisfies ResolveEmailCampaignFormAttributionResult)
    }

    try {
      const log = await emailLogRepository.findCampaignLogForAttribution(input.teamId, emailLogId)

      if (!log) {
        return new Output(true, [], [], {
          leadId: null,
          campaignId: null,
          emailLogId,
          enrichedOrigin,
        } satisfies ResolveEmailCampaignFormAttributionResult)
      }

      enrichedOrigin.emailLogId = log.id
      enrichedOrigin.recipientEmail = log.recipientEmail
      if (log.campaignId) enrichedOrigin.campaignId = log.campaignId
      if (log.dispatchId) enrichedOrigin.dispatchId = log.dispatchId

      const phone = await this.resolveRecipientPhone(input.teamId, log.recipientEmail, log.campaignId)
      const name = resolveAttributionDisplayName(log.recipientName, log.recipientEmail)
      const email = log.recipientEmail.trim().toLowerCase()
      const normalizedPhone = phone ? normalizeLeadPhoneDigits(phone) : ""
      enrichedOrigin.recipientEmail = email

      const match = await findMatchingLead(input.teamId, {
        native: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone: phone ?? "" } : {}),
        },
        custom: {},
        notes: [],
        name,
        email,
        phone: phone ?? "",
        normalizedPhone,
      })
      const lead: Lead | null = match ?? null

      if (lead) {
        if (input.eventType === "form_started") {
          await this.ensureLeadActivity({
            leadId: lead.id,
            body: FORM_START_ACTIVITY_BODY,
            kind: "public_form_started",
            formId: input.formId,
            formName: input.formName,
            formPublicId: input.formPublicId,
            publicationId: input.publicationId,
            emailLogId: log.id,
            campaignId: log.campaignId,
            origin: enrichedOrigin,
          })
        }

        if (input.eventType !== "form_viewed") {
          void syncLeadToRadarUseCase
            .execute({ leadId: lead.id, teamId: input.teamId })
            .catch((error) => {
              console.error("[ResolveEmailCampaignFormAttributionUseCase][syncLeadToRadar]", error)
            })
        }
      }

      return new Output(true, [], [], {
        leadId: lead?.id ?? null,
        campaignId: log.campaignId,
        emailLogId: log.id,
        enrichedOrigin,
      } satisfies ResolveEmailCampaignFormAttributionResult)
    } catch (error) {
      console.error("[ResolveEmailCampaignFormAttributionUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao resolver atribuição e-mail→formulário"
      return new Output(false, [], [message], null)
    }
  }

  private async resolveRecipientPhone(
    teamId: string,
    recipientEmail: string,
    campaignId: string | null
  ): Promise<string | null> {
    const email = recipientEmail.trim().toLowerCase()
    if (campaignId) {
      const listIds = await publicFormsRepository.findCampaignContactListIds(teamId, campaignId)
      const customFields = await publicFormsRepository.findEmailContactCustomFields(email, listIds)
      const fromContact = extractPhoneFromCustomFields(
        customFields as Record<string, unknown> | null
      )
      if (fromContact) return fromContact
    }

    return publicFormsRepository.findRadarPhoneByEmail(teamId, email)
  }

  private async ensureLeadActivity(input: {
    leadId: string
    body: string
    kind: "public_form_started"
    formId: string
    formName: string
    formPublicId: string
    publicationId: string
    emailLogId: string
    campaignId: string | null
    origin: Record<string, unknown>
  }): Promise<void> {
    const existing = await publicFormsRepository.findLeadActivityByEmailLogAttribution({
      leadId: input.leadId,
      body: input.body,
      emailLogId: input.emailLogId,
    })
    if (existing) return

    await publicFormsRepository.createLeadActivityNote({
      leadId: input.leadId,
      body: input.body,
      payload: json({
        kind: input.kind,
        formId: input.formId,
        formName: input.formName,
        formPublicId: input.formPublicId,
        publicationId: input.publicationId,
        emailLogId: input.emailLogId,
        campaignId: input.campaignId,
        origin: input.origin,
      }),
    })
  }
}

export const resolveEmailCampaignFormAttributionUseCase =
  new ResolveEmailCampaignFormAttributionUseCase()
