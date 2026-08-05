import { LeadStatus, Prisma } from "@prisma/client"
import type { Lead } from "@prisma/client"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase"
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { findMatchingLead } from "@/app/api/useCases/publicForms/publicFormLeadSync"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import { Output } from "@/lib/output"
import {
  extractPhoneFromCustomFields,
  FORM_START_ACTIVITY_BODY,
  parseEmailLogIdFromOrigin,
  resolveAttributionDisplayName,
} from "@/lib/public-forms/email-campaign-attribution"
import { isValidPhone, normalizeLeadPhoneDigits } from "@/lib/masks"

const leadUseCase = new LeadUseCase(new LeadRepository(), new RegisterNewUserProfile())

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
 * Resolve `cs_el` → EmailLog → lead CRM + atividades de início + identidade Radar.
 * Premissa: EmailLog.id é o PID por destinatário no disparo da campanha.
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

      const lead = await this.upsertLeadFromEmailRecipient({
        teamId: input.teamId,
        formId: input.formId,
        formName: input.formName,
        formPublicId: input.formPublicId,
        publicationId: input.publicationId,
        eventType: input.eventType,
        name,
        email,
        phone: phone ?? "",
        normalizedPhone,
        campaignId: log.campaignId,
        emailLogId: log.id,
        origin: enrichedOrigin,
      })

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

        void syncLeadToRadarUseCase
          .execute({ leadId: lead.id, teamId: input.teamId })
          .catch((error) => {
            console.error("[ResolveEmailCampaignFormAttributionUseCase][syncLeadToRadar]", error)
          })
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

  private async upsertLeadFromEmailRecipient(input: {
    teamId: string
    formId: string
    formName: string
    formPublicId: string
    publicationId: string
    eventType: ResolveEmailCampaignFormAttributionInput["eventType"]
    name: string
    email: string
    phone: string
    normalizedPhone: string
    campaignId: string | null
    emailLogId: string
    origin: Record<string, unknown>
  }): Promise<Lead | null> {
    const form = await publicFormsRepository.findFormSubmissionContext(input.formId)
    if (!form?.team.master.supabaseId) return null

    const match = await findMatchingLead(input.teamId, {
      native: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      },
      custom: {},
      notes: [],
      name: input.name,
      email: input.email,
      phone: input.phone,
      normalizedPhone: input.normalizedPhone,
    })

    if (match) {
      const data: Prisma.LeadUncheckedUpdateInput = {
        updatedBy: form.team.master.id,
      }
      if (!match.email && input.email) data.email = input.email
      if (!match.phone && input.phone) data.phone = input.phone
      if (!data.email && !data.phone) return match
      return publicFormsRepository.updateLead(match.id, data)
    }

    // E1: form_viewed/form_started não criam Lead fantasma — só form_completed.
    if (input.eventType !== "form_completed") {
      return null
    }

    // Regra CRM: lead só nasce com nome + telefone válidos (sem telefone → só Radar por e-mail).
    const trimmedName = input.name.trim()
    if (trimmedName.length < 2 || !isValidPhone(input.normalizedPhone || input.phone)) {
      console.info(
        "[ResolveEmailCampaignFormAttributionUseCase][createLead] skip: nome/telefone insuficientes",
        { emailLogId: input.emailLogId, hasName: trimmedName.length >= 2, hasPhone: Boolean(input.normalizedPhone) }
      )
      return null
    }

    const createData: CreateLeadRequest = {
      name: trimmedName,
      email: input.email,
      phone: input.normalizedPhone || input.phone,
      cnpj: undefined,
      age: undefined,
      currentHealthPlan: undefined,
      currentValue: undefined,
      referenceHospital: undefined,
      currentTreatment: undefined,
      meetingDate: undefined,
      meetingTitle: undefined,
      meetingNotes: undefined,
      meetingLink: undefined,
      notes: undefined,
      assignedTo: form.assignedSdrId ?? undefined,
      closerId: undefined,
      status: LeadStatus.new_opportunity,
      ticket: undefined,
      contractDueDate: undefined,
      soldPlan: undefined,
      customFields: undefined,
      confirmDuplicate: true,
      originChannel: "public_form",
      originMetadata: {
        source: input.formName,
        formId: input.formId,
        formPublicId: input.formPublicId,
        emailLogId: input.emailLogId,
        campaignId: input.campaignId,
        firstFormAt: new Date().toISOString(),
        attribution: "email_campaign",
      },
    }

    const output = await leadUseCase.createLead(
      form.team.master.supabaseId,
      createData,
      input.teamId,
      {
        authorAsStudio: true,
        body: "Lead criado via atribuição de campanha de e-mail",
        payload: {
          kind: "lead_creation",
          channel: "email_campaign_form",
          formName: input.formName,
          formId: input.formId,
          formPublicId: input.formPublicId,
          publicationId: input.publicationId,
          emailLogId: input.emailLogId,
          campaignId: input.campaignId,
          origin: json(input.origin),
        },
      },
      { autoScheduleMeeting: false }
    )
    if (!output.isValid) {
      console.error(
        "[ResolveEmailCampaignFormAttributionUseCase][createLead]",
        output.errorMessages.join("; ")
      )
      return null
    }
    return output.result as Lead
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
