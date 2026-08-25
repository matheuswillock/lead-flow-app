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

/** Nota do anexo em lead na lixeira (DA3) — restaurar continua sendo gesto do usuário. */
export const DELETED_LEAD_ATTACH_NOTE =
  "Nova resposta de formulário público recebida enquanto este lead estava na lixeira. Restaure o lead para retomar o atendimento."

export async function findMatchingLead(
  teamId: string,
  data: ExtractedLeadData,
): Promise<Lead | undefined> {
  return pickBestLeadMatch(
    await publicFormsRepository.findLeadCandidates(
      teamId,
      data.email,
      data.phone,
      data.normalizedPhone,
    ),
    data,
  )
}

function pickBestLeadMatch(candidates: Lead[], data: ExtractedLeadData): Lead | undefined {
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

type LeadAttachContext = {
  form: PublicFormSubmissionContext
  snapshot: PublicFormSnapshot
}

async function attachToLiveLead(
  context: LeadAttachContext,
  match: Lead,
  extracted: ExtractedLeadData,
): Promise<UpsertLeadResult | null> {
  if (!canUpdateLeadFromExtracted(extracted)) return null
  const notes = mergeFormMappedLeadNotes(match.notes, context.snapshot, extracted.notes)
  const lead = await publicFormsRepository.updateLead(match.id, {
    ...extracted.native,
    notes,
    updatedBy: context.form.team.master.id,
  })
  for (const [key, value] of Object.entries(extracted.custom)) {
    const definitionId = await publicFormsRepository.findCustomFieldDefinitionId(
      context.form.teamId,
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

/**
 * DA3: o único conflito é um lead na lixeira. A conversão fica rastreável — a
 * submissão passa a apontar para ele — mas nenhum campo de identidade é
 * sobrescrito e `deletedAt` não é tocado: restaurar é gesto do usuário, não
 * efeito colateral de um formulário público.
 */
async function attachToDeletedLead(match: Lead): Promise<UpsertLeadResult> {
  const previousNotes = match.notes?.trim()
  // Idempotente (review #1042): o job pode ser reprocessado pelo drain, e a
  // mesma frase fixa acabaria repetida em cada passagem até tomar conta das
  // notas do lead. Já está lá, não acrescenta.
  if (previousNotes?.includes(DELETED_LEAD_ATTACH_NOTE)) {
    return { lead: match, created: false }
  }
  const notes = previousNotes
    ? `${previousNotes}\n${DELETED_LEAD_ATTACH_NOTE}`
    : DELETED_LEAD_ATTACH_NOTE
  const lead = await publicFormsRepository.updateLead(match.id, { notes })
  console.info("[publicFormLeadSync][attachToDeletedLead] submissão anexada a lead na lixeira", {
    leadId: match.id,
    teamId: match.teamId,
  })
  return { lead, created: false }
}

/**
 * DA3: `createLead` recusou por unique. Isso é esperado numa fila
 * at-least-once — dois eventos concorrentes, ou um candidato que
 * `findLeadCandidates` não enxerga (a unique inclui soft-deletados). Em vez de
 * lançar (o poison do F9, que retentava para sempre), re-resolve e anexa.
 *
 * São DUAS condições, e as duas precisam valer (review #1042): a recusa tem de
 * ser de unique **e** tem de existir o lead conflitante. Só a segunda deixava
 * um erro não relacionado — plano de saúde inválido, master sem perfil — virar
 * sucesso silencioso sempre que houvesse um lead com o mesmo e-mail na lixeira.
 * Só a primeira dependeria da mensagem em português, que é frágil.
 */
const DUPLICATE_LEAD_ERROR_MARKERS = ["ja existe um lead", "já existe um lead"]

function isDuplicateLeadRejection(errorMessages: string[]): boolean {
  const joined = errorMessages.join(" ").toLowerCase()
  return DUPLICATE_LEAD_ERROR_MARKERS.some((marker) => joined.includes(marker))
}

async function reconcileLeadAfterFailedCreate(
  context: LeadAttachContext,
  extracted: ExtractedLeadData,
): Promise<UpsertLeadResult | null> {
  const teamId = context.form.teamId
  const live = pickBestLeadMatch(
    await publicFormsRepository.findLeadCandidates(
      teamId,
      extracted.email,
      extracted.phone,
      extracted.normalizedPhone,
    ),
    extracted,
  )
  if (live) return attachToLiveLead(context, live, extracted)

  const deleted = pickBestLeadMatch(
    await publicFormsRepository.findDeletedLeadCandidates(
      teamId,
      extracted.email,
      extracted.phone,
      extracted.normalizedPhone,
    ),
    extracted,
  )
  if (deleted) return attachToDeletedLead(deleted)

  return null
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
  const match = await findMatchingLead(input.form.teamId, extracted)

  if (match) {
    return attachToLiveLead({ form: input.form, snapshot: input.snapshot }, match, extracted)
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
  if (!output.isValid) {
    const reconciled = isDuplicateLeadRejection(output.errorMessages)
      ? await reconcileLeadAfterFailedCreate(
          { form: input.form, snapshot: input.snapshot },
          extracted,
        )
      : null
    if (reconciled) return reconciled
    throw new Error(output.errorMessages.join("; "))
  }
  return { lead: output.result as Lead, created: true }
}
