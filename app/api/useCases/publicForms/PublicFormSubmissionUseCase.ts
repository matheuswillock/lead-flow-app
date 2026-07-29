import { LeadStatus, Prisma } from "@prisma/client"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { publicFormsService } from "@/app/api/services/PublicForms/PublicFormsService"
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService"
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase"
import { formatLocalDateValue, formatLocalTimeValue, DEFAULT_TZ } from "@/lib/dates"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import { Output } from "@/lib/output"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import {
  calculatePublicFormScorePercent,
  resolveVisibleQuestionIds,
  validateAnswer,
} from "@/lib/public-forms/engine"
import type { PublicFormSubmissionInput, PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  extractLeadDataFromSnapshot,
  upsertLeadFromFormAnswers,
} from "./publicFormLeadSync"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export class PublicFormSubmissionUseCase {
  async execute(publicId: string, input: PublicFormSubmissionInput): Promise<Output> {
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

    const progressSubmission =
      input.visitorSessionId != null
        ? await publicFormsRepository.findProgressSubmission(
            current.publicationId,
            input.visitorSessionId,
          )
        : null

    const { snapshot } = current
    const visible = new Set(resolveVisibleQuestionIds(snapshot, input.answers))
    const visibleAnswers = input.answers.filter((answer) => visible.has(answer.questionId))
    const answerMap = new Map(visibleAnswers.map((answer) => [answer.questionId, answer.value]))
    const errors = snapshot.questions.flatMap((question) => {
      if (!visible.has(question.id)) return []
      const error = validateAnswer(question, answerMap.get(question.id))
      return error ? [`${question.title}: ${error}`] : []
    })
    if (errors.length > 0) return new Output(false, [], errors, null)

    const score = calculatePublicFormScorePercent(snapshot, visibleAnswers)
    const band = snapshot.scoreBands.find(
      (item) => score >= item.minScore && score <= item.maxScore,
    )
    const origin = sanitizePublicFormOrigin(input.origin)

    const nameCheck = extractLeadDataFromSnapshot(snapshot, visibleAnswers, visible).name
    if (!nameCheck) {
      return new Output(false, [], ["O formulário não forneceu o nome obrigatório do lead"], null)
    }

    const bandNote = band
      ? [`Qualificação: ${band.label}${band.summary ? ` — ${band.summary}` : ""}`]
      : undefined

    const submission = progressSubmission
      ? await publicFormsRepository.finalizeProgressSubmission(progressSubmission.id, {
          requestKey: input.requestKey,
          score,
          scoreBandLabel: band?.label,
          origin: origin as Prisma.InputJsonValue,
          visitorSessionId: input.visitorSessionId ?? null,
        })
      : await publicFormsRepository.createSubmission({
          formId: snapshot.formId,
          publicationId: current.publicationId,
          requestKey: input.requestKey,
          visitorSessionId: input.visitorSessionId ?? null,
          score,
          scoreBandLabel: band?.label,
          origin: origin as Prisma.InputJsonValue,
          completionStatus: "partial",
        })

    try {
      const form = await publicFormsRepository.findFormSubmissionContext(snapshot.formId)
      const upserted = await upsertLeadFromFormAnswers({
        form,
        snapshot,
        answers: visibleAnswers,
        visibleIds: visible,
        score,
        scoreBandLabel: band?.label ?? null,
        submissionId: submission.id,
        publicationId: current.publicationId,
        origin: origin as Record<string, unknown>,
        extraNotes: bandNote,
      })
      const lead = upserted?.lead
      if (!lead) throw new Error("Não foi possível criar ou localizar o lead")
      const created = upserted.created

      let scheduled = false
      if (input.scheduling) {
        if (!snapshot.schedulingEnabled || snapshot.eligibleCloserIds.length === 0) {
          throw new Error("Agendamento indisponível para este formulário")
        }

        const timezone = form.team.master.timezone || DEFAULT_TZ
        const startsAt = new Date(input.scheduling.startsAt)
        if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60_000) {
          throw new Error("Horário de agendamento inválido ou já passou")
        }

        const dateKey = formatLocalDateValue(startsAt, timezone)
        const timeKey = formatLocalTimeValue(startsAt, timezone)
        const availableCloserIds: string[] = []
        for (const closerId of snapshot.eligibleCloserIds) {
          const availabilityOutput = await publicLeadFormUseCase.getCloserAvailability(
            form.teamId,
            closerId,
            dateKey,
            undefined,
            snapshot.meetingDurationMinutes,
          )
          if (!availabilityOutput.isValid) continue
          const availableTimes =
            (availabilityOutput.result as { availableTimes?: string[] } | null)?.availableTimes ??
            []
          if (availableTimes.includes(timeKey)) availableCloserIds.push(closerId)
        }
        if (availableCloserIds.length === 0) {
          throw new Error("O horário selecionado não está mais disponível")
        }

        const closerId =
          availableCloserIds[Math.floor(Math.random() * availableCloserIds.length)]!

        const closerProfile = await publicFormsRepository.findCloserGoogleConnection(closerId)
        const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile?.googleConnection)
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
          closerId,
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
      const visitorSessionId = (input.visitorSessionId ?? input.requestKey).slice(0, 100)
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
          formName: form.name,
          publicationId: current.publicationId,
          publicationVersion: snapshot.version,
          submissionId: submission.id,
          thankYouPageId: input.thankYouPageId ?? null,
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
