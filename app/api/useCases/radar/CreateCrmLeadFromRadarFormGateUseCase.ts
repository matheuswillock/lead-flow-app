import { Output } from "@/lib/output"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { parsePublicFormSnapshot } from "@/lib/public-forms/publication-snapshot"
import { resolveVisibleQuestionIds } from "@/lib/public-forms/engine"
import {
  hasCrmGateAC,
  overlayRadarIdentityOnExtracted,
  extractLeadDataFromSnapshot,
} from "@/lib/public-forms/lead-identity"
import { upsertLeadFromFormAnswers } from "@/app/api/useCases/publicForms/publicFormLeadSync"
import type { PublicFormAnswerInput } from "@/lib/public-forms/types"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"

export type CreateCrmLeadFromRadarFormGateInput = {
  teamId: string
  formId: string
  publicationId: string
  visitorSessionId: string
  origin: unknown
  profileId: string | null
  questionId?: string | null
  answerValue?: string | null
}

function asOriginRecord(origin: unknown): Record<string, unknown> {
  if (!origin || typeof origin !== "object") return {}
  return origin as Record<string, unknown>
}

function mergeCurrentAnswer(
  answers: PublicFormAnswerInput[],
  questionId: string | null | undefined,
  answerValue: string | null | undefined,
): PublicFormAnswerInput[] {
  if (!questionId || !answerValue?.trim()) return answers
  const next = answers.filter((answer) => answer.questionId !== questionId)
  next.push({ questionId, value: answerValue })
  return next
}

class CreateCrmLeadFromRadarFormGateUseCase {
  async execute(input: CreateCrmLeadFromRadarFormGateInput): Promise<Output> {
    try {
      const publication = await publicFormsRepository.findPublicationById(input.publicationId)
      const snapshot = publication ? parsePublicFormSnapshot(publication.snapshot) : null
      if (!snapshot) {
        return new Output(true, [], [], { skipped: "snapshot_unavailable" })
      }

      const session = await publicFormsRepository.findLatestSessionSubmissionOnForm(
        input.formId,
        input.visitorSessionId,
      )
      const storedAnswers = session
        ? await publicFormsRepository.listSubmissionAnswers(session.id)
        : []
      const answers = mergeCurrentAnswer(storedAnswers, input.questionId, input.answerValue)
      if (answers.length === 0) {
        return new Output(true, [], [], { skipped: "no_answers" })
      }

      const profile = input.profileId
        ? await radarRepository.findProfileForFormLeadGate(input.teamId, input.profileId)
        : null
      if (profile?.identities.some((identity) => identity.type === "lead_id")) {
        const existingLeadId =
          profile.identities.find((identity) => identity.type === "lead_id")?.value ??
          profile.identities.find((identity) => identity.type === "lead_id")?.normalizedValue
        if (existingLeadId && session && !session.leadId) {
          await publicFormsRepository.attachLeadIdToSessionSubmission(
            input.formId,
            input.visitorSessionId,
            existingLeadId,
          )
        }
        return new Output(true, [], [], {
          skipped: "already_linked",
          leadId: session?.leadId ?? existingLeadId ?? null,
        })
      }

      const visible = new Set(resolveVisibleQuestionIds(snapshot, answers))
      const extracted = overlayRadarIdentityOnExtracted(
        extractLeadDataFromSnapshot(snapshot, answers, visible),
        profile,
      )
      if (!hasCrmGateAC(extracted)) {
        return new Output(true, [], [], { skipped: "gate_open" })
      }

      const sessionLeadId = session?.leadId ?? null
      const form = await publicFormsRepository.findFormSubmissionContext(input.formId)
      const origin = sanitizePublicFormOrigin(asOriginRecord(input.origin))
      const upserted = await upsertLeadFromFormAnswers({
        form,
        snapshot,
        answers,
        visibleIds: visible,
        publicationId: input.publicationId,
        origin,
        submissionId: session?.id,
        allowCreate: !sessionLeadId,
        identityOverlay: profile,
      })
      const leadId = upserted?.lead.id ?? sessionLeadId
      if (!leadId) {
        return new Output(true, [], [], { skipped: "upsert_skipped" })
      }

      await publicFormsRepository.attachLeadIdToSessionSubmission(
        input.formId,
        input.visitorSessionId,
        leadId,
      )

      if (input.profileId) {
        await radarRepository.tryClaimLeadIdentity(
          input.teamId,
          input.profileId,
          leadId,
          "public_form_radar_gate",
        )
      }

      console.info("[CreateCrmLeadFromRadarFormGateUseCase][execute] gate A+C fechado", {
        teamId: input.teamId,
        formId: input.formId,
        visitorSessionId: input.visitorSessionId,
        profileId: input.profileId,
        leadId,
        created: upserted?.created ?? false,
      })

      return new Output(true, [], [], {
        leadId,
        created: upserted?.created ?? false,
      })
    } catch (error) {
      console.error("[CreateCrmLeadFromRadarFormGateUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao criar lead CRM a partir do Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const createCrmLeadFromRadarFormGateUseCase = new CreateCrmLeadFromRadarFormGateUseCase()
