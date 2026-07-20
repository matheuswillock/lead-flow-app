import { LeadStatus, Prisma } from "@prisma/client"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { publicFormsService } from "@/app/api/services/PublicForms/PublicFormsService"
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService"
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase"
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase"
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import { formatLocalDateValue, formatLocalTimeValue, DEFAULT_TZ } from "@/lib/dates"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import { normalizeLeadPhoneDigits } from "@/lib/masks"
import { Output } from "@/lib/output"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import {
  calculatePublicFormScore,
  resolveVisibleQuestionIds,
  validateAnswer,
} from "@/lib/public-forms/engine"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

const leadUseCase = new LeadUseCase(new LeadRepository(), new RegisterNewUserProfile())
const nativeKeys = new Set([
  "name",
  "email",
  "phone",
  "cnpj",
  "age",
  "currentHealthPlan",
  "currentValue",
  "referenceHospital",
  "currentTreatment",
])

function valueText(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value ?? "")
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

type SubmissionInput = {
  requestKey: string
  answers: PublicFormAnswerInput[]
  origin: Record<string, unknown>
  scheduling?: { closerId: string; startsAt: string }
}

export class PublicFormSubmissionUseCase {
  async execute(publicId: string, input: SubmissionInput): Promise<Output> {
    const current = (await publicFormsService.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return new Output(false, [], ["Formulário indisponível"], null)

    const existing = await publicFormsRepository.findSubmissionByRequestKey(input.requestKey)
    if (existing) {
      if (existing.status === "completed") {
        return new Output(true, ["Respostas já recebidas"], [], { submissionId: existing.id })
      }
      return new Output(
        false,
        [],
        [existing.errorMessage || "Esta resposta já está sendo processada"],
        { submissionId: existing.id },
      )
    }

    const { snapshot } = current
    const visible = new Set(resolveVisibleQuestionIds(snapshot, input.answers))
    // Ignore answers for questions that became hidden after conditional navigation.
    const visibleAnswers = input.answers.filter((answer) => visible.has(answer.questionId))
    const answerMap = new Map(visibleAnswers.map((answer) => [answer.questionId, answer.value]))
    const errors = snapshot.questions.flatMap((question) => {
      if (!visible.has(question.id)) return []
      const error = validateAnswer(question, answerMap.get(question.id))
      return error ? [`${question.title}: ${error}`] : []
    })
    if (errors.length > 0) return new Output(false, [], errors, null)

    const score = calculatePublicFormScore(snapshot, visibleAnswers)
    const band = snapshot.scoreBands.find(
      (item) => score >= item.minScore && score <= item.maxScore,
    )
    const origin = sanitizePublicFormOrigin(input.origin)
    const submission = await publicFormsRepository.createSubmission({
      formId: snapshot.formId,
      publicationId: current.publicationId,
      requestKey: input.requestKey,
      score,
      scoreBandLabel: band?.label,
      origin: origin as Prisma.InputJsonValue,
    })

    try {
      const form = await publicFormsRepository.findFormSubmissionContext(snapshot.formId)
      const native: Record<string, string | number> = {}
      const custom: Record<string, unknown> = {}
      const notes: string[] = []
      for (const question of snapshot.questions) {
        if (!visible.has(question.id) || !answerMap.has(question.id)) continue
        const value = answerMap.get(question.id)
        if (
          question.mappingTarget === "native_field" &&
          question.mappingKey &&
          nativeKeys.has(question.mappingKey)
        ) {
          native[question.mappingKey] =
            question.mappingKey === "currentValue" ? Number(value) : valueText(value)
        }
        if (question.mappingTarget === "custom_field" && question.mappingKey) {
          custom[question.mappingKey] = value
        }
        if (question.mappingTarget === "notes") notes.push(`${question.title}: ${valueText(value)}`)
      }
      if (band) {
        notes.push(`Qualificação: ${band.label}${band.summary ? ` — ${band.summary}` : ""}`)
      }
      const name = typeof native.name === "string" ? native.name.trim() : ""
      if (!name) throw new Error("O formulário não forneceu o nome obrigatório do lead")

      const email = typeof native.email === "string" ? native.email.trim().toLowerCase() : ""
      const phone = typeof native.phone === "string" ? native.phone : ""
      const normalizedPhone = phone ? normalizeLeadPhoneDigits(phone) : ""
      const candidates = await publicFormsRepository.findLeadCandidates(
        form.teamId,
        email,
        phone,
        normalizedPhone,
      )
      const match = candidates.find(
        (lead) =>
          (email && lead.email?.toLowerCase() === email) ||
          (normalizedPhone && normalizeLeadPhoneDigits(lead.phone ?? "") === normalizedPhone),
      )

      let lead = match
      let created = false
      if (lead) {
        lead = await publicFormsRepository.updateLead(lead.id, {
          ...native,
          notes: [lead.notes, notes.join("\n")].filter(Boolean).join("\n\n"),
          updatedBy: form.team.master.id,
        })
        for (const [key, value] of Object.entries(custom)) {
          const definitionId = await publicFormsRepository.findCustomFieldDefinitionId(
            form.teamId,
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
      } else {
        if (!form.team.master.supabaseId) {
          throw new Error("Master do time sem identificação de autenticação")
        }
        const createData: CreateLeadRequest = {
          name,
          email: email || undefined,
          phone: phone || undefined,
          cnpj: typeof native.cnpj === "string" ? native.cnpj : undefined,
          age: typeof native.age === "string" ? native.age : undefined,
          currentHealthPlan:
            typeof native.currentHealthPlan === "string" ? native.currentHealthPlan : undefined,
          currentValue: typeof native.currentValue === "number" ? native.currentValue : undefined,
          referenceHospital:
            typeof native.referenceHospital === "string" ? native.referenceHospital : undefined,
          currentTreatment:
            typeof native.currentTreatment === "string" ? native.currentTreatment : undefined,
          meetingDate: undefined,
          meetingTitle: undefined,
          meetingNotes: undefined,
          meetingLink: undefined,
          notes: notes.join("\n") || undefined,
          assignedTo: form.assignedSdrId ?? undefined,
          closerId: undefined,
          status: LeadStatus.new_opportunity,
          ticket: undefined,
          contractDueDate: undefined,
          soldPlan: undefined,
          customFields: custom,
          confirmDuplicate: true,
        }
        const output = await leadUseCase.createLead(
          form.team.master.supabaseId,
          createData,
          form.teamId,
          {
            authorAsStudio: true,
            body: "Lead criado via formulário público",
            payload: {
              kind: "public_form_submission",
              formId: form.id,
              publicationId: current.publicationId,
              submissionId: submission.id,
              score,
              scoreBand: band?.label ?? null,
              origin,
            },
          },
          { autoScheduleMeeting: false },
        )
        if (!output.isValid) throw new Error(output.errorMessages.join("; "))
        lead = output.result as NonNullable<typeof match>
        created = true
      }

      if (!lead) throw new Error("Não foi possível criar ou localizar o lead")
      let scheduled = false
      if (input.scheduling) {
        if (
          !snapshot.schedulingEnabled ||
          !snapshot.eligibleCloserIds.includes(input.scheduling.closerId)
        ) {
          throw new Error("Closer indisponível para este formulário")
        }

        const timezone = form.team.master.timezone || DEFAULT_TZ
        const startsAt = new Date(input.scheduling.startsAt)
        if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60_000) {
          throw new Error("Horário de agendamento inválido ou já passou")
        }

        const dateKey = formatLocalDateValue(startsAt, timezone)
        const timeKey = formatLocalTimeValue(startsAt, timezone)
        const availabilityOutput = await publicLeadFormUseCase.getCloserAvailability(
          form.teamId,
          input.scheduling.closerId,
          dateKey,
          undefined,
          snapshot.meetingDurationMinutes,
        )
        if (!availabilityOutput.isValid) {
          throw new Error(availabilityOutput.errorMessages.join("; ") || "Horário indisponível")
        }
        const availableTimes =
          (availabilityOutput.result as { availableTimes?: string[] } | null)?.availableTimes ?? []
        if (!availableTimes.includes(timeKey)) {
          throw new Error("O horário selecionado não está mais disponível")
        }

        const closerProfile = await publicFormsRepository.findCloserGoogleConnection(
          input.scheduling.closerId,
        )
        const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile?.googleConnection)
        // Public forms cannot collect a manual Meet link; fall back to call when Google is offline.
        const meetingType = canUseGoogleCalendar ? "online" : "call"

        const scheduleOutput = await leadScheduleService.createSchedule({
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          leadStatus: lead.status ?? LeadStatus.new_opportunity,
          leadManagerId: form.team.master.id,
          leadAssignedTo: form.assignedSdrId,
          leadAssigneeEmail: form.assignedSdr?.email ?? null,
          leadCurrentCloserId: lead.closerId,
          leadCode: lead.leadCode,
          closerId: input.scheduling.closerId,
          teamId: form.teamId,
          meetingDate: input.scheduling.startsAt,
          meetingTitle: `Reunião — ${lead.name}`,
          meetingNotes: snapshot.schedulingMessage ?? undefined,
          meetingType,
          durationMinutes: snapshot.meetingDurationMinutes,
          createdByProfileId: form.team.master.id,
          transitionStatusToScheduled: true,
          authorAsStudio: true,
        })
        if (!scheduleOutput.isValid) throw new Error(scheduleOutput.errorMessages.join("; "))
        scheduled = true
      }

      const eventType = created ? ("lead_created" as const) : ("lead_attached" as const)
      const visitorSessionId = input.requestKey.slice(0, 100)
      const metricEvents: Array<{
        formId: string
        publicationId: string
        visitorSessionId: string
        eventType: "form_completed" | "lead_created" | "lead_attached" | "meeting_scheduled"
        eventKey: string
        origin: Prisma.InputJsonValue
      }> = [
        {
          formId: snapshot.formId,
          publicationId: current.publicationId,
          visitorSessionId,
          eventType: "form_completed",
          eventKey: `${input.requestKey}:form_completed`,
          origin: origin as Prisma.InputJsonValue,
        },
        {
          formId: snapshot.formId,
          publicationId: current.publicationId,
          visitorSessionId,
          eventType,
          eventKey: `${input.requestKey}:${eventType}`,
          origin: origin as Prisma.InputJsonValue,
        },
      ]
      if (scheduled) {
        metricEvents.push({
          formId: snapshot.formId,
          publicationId: current.publicationId,
          visitorSessionId,
          eventType: "meeting_scheduled",
          eventKey: `${input.requestKey}:meeting_scheduled`,
          origin: origin as Prisma.InputJsonValue,
        })
      }

      await publicFormsRepository.completeSubmission({
        submissionId: submission.id,
        leadId: lead.id,
        answers: visibleAnswers.map((answer) => {
          const question = snapshot.questions.find((item) => item.id === answer.questionId)
          if (!question) throw new Error("Snapshot de pergunta não encontrado")
          return {
            questionId: answer.questionId,
            value: answer.value as Prisma.InputJsonValue,
            questionSnapshot: json(question),
          }
        }),
        activityBody: "Respostas recebidas por formulário público",
        activityPayload: json({
          kind: "public_form_submission",
          formId: snapshot.formId,
          publicationId: current.publicationId,
          publicationVersion: snapshot.version,
          submissionId: submission.id,
          score,
          scoreBand: band?.label ?? null,
          origin,
        }),
        metricEvents,
      })
      return new Output(
        true,
        [scheduled ? "Respostas recebidas e reunião agendada" : "Respostas recebidas"],
        [],
        { submissionId: submission.id, scheduled },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar respostas"
      await publicFormsRepository.markSubmissionFailed(submission.id, message)
      return new Output(false, [], [message], { submissionId: submission.id })
    }
  }
}

export const publicFormSubmissionUseCase = new PublicFormSubmissionUseCase()
