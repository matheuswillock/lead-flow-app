import { LeadStatus, Prisma } from "@prisma/client"
import type { Lead } from "@prisma/client"
import type { PublicFormSubmissionContext } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase"
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import { normalizeLeadPhoneDigits } from "@/lib/masks"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  overlayRadarIdentityOnExtracted,
  type ExtractedLeadData,
  type RadarIdentityOverlay,
} from "@/lib/public-forms/lead-identity"
import { mergeFormMappedLeadNotes } from "@/lib/public-forms/lead-notes"
import { resolvePublicFormLeadAssignment } from "@/lib/public-forms/resolve-public-form-lead-assignment"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { formatEmailCampaignLeadCreatedActivityBody } from "@/lib/public-forms/email-campaign-attribution"
import { isEmailCampaignFormOrigin } from "@/lib/public-forms/origin"
import type {
  PublicFormAnswerInput,
  PublicFormSnapshot,
} from "@/lib/public-forms/types"

export {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
  overlayRadarIdentityOnExtracted,
  isBlankPublicFormAnswerValue,
  publicFormAnswerValueText,
  type ExtractedLeadData,
  type RadarIdentityOverlay,
} from "@/lib/public-forms/lead-identity"

const leadUseCase = new LeadUseCase(new LeadRepository(), new RegisterNewUserProfile())

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function findMatchingLead(
  teamId: string,
  data: ExtractedLeadData,
): Promise<Lead | undefined> {
  const candidates = await publicFormsRepository.findLeadCandidates(
    teamId,
    data.email,
    data.phone,
    data.normalizedPhone,
  )
  if (candidates.length === 0) return undefined

  const byEmail = data.email
    ? candidates.find((lead) => lead.email?.toLowerCase() === data.email)
    : undefined
  if (byEmail) return byEmail

  const byPhone = data.normalizedPhone
    ? candidates.find(
        (lead) => normalizeLeadPhoneDigits(lead.phone ?? "") === data.normalizedPhone,
      )
    : undefined
  if (byPhone) return byPhone

  if (data.name) {
    const normalizedName = data.name.toLowerCase()
    const byName = candidates.filter((lead) => lead.name.toLowerCase() === normalizedName)
    if (byName.length === 1) return byName[0]
  }

  return undefined
}

export type UpsertLeadResult = {
  lead: Lead
  created: boolean
}

export async function upsertLeadFromFormAnswers(input: {
  form: PublicFormSubmissionContext
  snapshot: PublicFormSnapshot
  answers: PublicFormAnswerInput[]
  visibleIds: Set<string>
  score?: number
  scoreBandLabel?: string | null
  submissionId?: string
  publicationId: string
  origin: Record<string, unknown>
  extraNotes?: string[]
  allowCreate?: boolean
  identityOverlay?: RadarIdentityOverlay | null
}): Promise<UpsertLeadResult | null> {
  const extracted = overlayRadarIdentityOnExtracted(
    extractLeadDataFromSnapshot(input.snapshot, input.answers, input.visibleIds),
    input.identityOverlay,
  )
  if (input.extraNotes?.length) {
    extracted.notes.push(...input.extraNotes)
  }
  // DA4: `leadCaptureDisabled` é declaração do dono do form — este é um
  // formulário de pesquisa. Sai antes de qualquer busca de lead: não cria, não
  // atualiza, e por consequência não gera métrica de lead nenhuma. Sem
  // captação, sem promessa de funil.
  if (input.snapshot.leadCaptureDisabled) return null

  const match = await findMatchingLead(input.form.teamId, extracted)

  if (match) {
    if (!canUpdateLeadFromExtracted(extracted)) return null
    const notes = mergeFormMappedLeadNotes(match.notes, input.snapshot, extracted.notes)
    const lead = await publicFormsRepository.updateLead(match.id, {
      ...extracted.native,
      notes,
      updatedBy: input.form.team.master.id,
    })
    for (const [key, value] of Object.entries(extracted.custom)) {
      const definitionId = await publicFormsRepository.findCustomFieldDefinitionId(
        input.form.teamId,
        key,
      )
      if (definitionId) {
        await publicFormsRepository.upsertLeadCustomFieldValue(
          lead.id,
          definitionId,
          value as Prisma.InputJsonValue,
        )
      }
    }
    return { lead, created: false }
  }

  if (!canCreateLeadFromExtracted(extracted)) return null
  if (input.allowCreate === false) return null
  if (!input.form.team.master.supabaseId) {
    throw new Error("Master do time sem identificação de autenticação")
  }

  const fromEmailCampaign = isEmailCampaignFormOrigin(input.origin)
  let campaignName: string | null = null
  if (fromEmailCampaign && typeof input.origin.emailLogId === "string") {
    const log = await emailLogRepository.findCampaignLogForAttribution(
      input.form.teamId,
      input.origin.emailLogId,
    )
    campaignName = log?.campaignName ?? null
  }
  const createData: CreateLeadRequest = {
    name: extracted.name,
    email: extracted.email || undefined,
    phone: extracted.phone || undefined,
    cnpj: typeof extracted.native.cnpj === "string" ? extracted.native.cnpj : undefined,
    age: typeof extracted.native.age === "string" ? extracted.native.age : undefined,
    currentHealthPlan:
      typeof extracted.native.currentHealthPlan === "string"
        ? extracted.native.currentHealthPlan
        : undefined,
    currentValue:
      typeof extracted.native.currentValue === "number" ? extracted.native.currentValue : undefined,
    referenceHospital:
      typeof extracted.native.referenceHospital === "string"
        ? extracted.native.referenceHospital
        : undefined,
    currentTreatment:
      typeof extracted.native.currentTreatment === "string"
        ? extracted.native.currentTreatment
        : undefined,
    meetingDate: undefined,
    meetingTitle: undefined,
    meetingNotes: undefined,
    meetingLink: undefined,
    notes: extracted.notes.join("\n") || undefined,
    ...resolvePublicFormLeadAssignment(input.form),
    status: LeadStatus.new_opportunity,
    ticket: undefined,
    contractDueDate: undefined,
    soldPlan: undefined,
    customFields: extracted.custom,
    confirmDuplicate: true,
    originChannel: fromEmailCampaign ? "email_campaign" : "public_form",
    originMetadata: {
      source: input.form.name,
      formId: input.form.id,
      formPublicId: input.form.publicId,
      firstFormAt: new Date().toISOString(),
      ...(fromEmailCampaign
        ? {
            attribution: "email_campaign",
            ...(typeof input.origin.emailLogId === "string"
              ? { emailLogId: input.origin.emailLogId }
              : {}),
            ...(typeof input.origin.campaignId === "string"
              ? { campaignId: input.origin.campaignId }
              : {}),
          }
        : {}),
    },
  }

  const output = await leadUseCase.createLead(
    input.form.team.master.supabaseId,
    createData,
    input.form.teamId,
    {
      authorAsStudio: true,
      body: fromEmailCampaign
        ? formatEmailCampaignLeadCreatedActivityBody(campaignName)
        : "Lead criado via formulário público",
      payload: {
        kind: "lead_creation",
        channel: fromEmailCampaign ? "email_campaign_form" : "public_form",
        formName: input.form.name,
        formId: input.form.id,
        formPublicId: input.form.publicId,
        publicationId: input.publicationId,
        submissionId: input.submissionId ?? null,
        score: input.score ?? null,
        scoreBand: input.scoreBandLabel ?? null,
        origin: json(input.origin),
        submittedAt: new Date().toISOString(),
        ...(fromEmailCampaign
          ? {
              ...(typeof input.origin.emailLogId === "string"
                ? { emailLogId: input.origin.emailLogId }
                : {}),
              ...(typeof input.origin.campaignId === "string"
                ? { campaignId: input.origin.campaignId }
                : {}),
              campaignName,
            }
          : {}),
      },
    },
    { autoScheduleMeeting: false },
  )
  if (!output.isValid) throw new Error(output.errorMessages.join("; "))
  return { lead: output.result as Lead, created: true }
}
