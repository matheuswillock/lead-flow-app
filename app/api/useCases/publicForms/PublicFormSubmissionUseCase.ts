import { LeadStatus, Prisma, type Lead } from "@prisma/client"
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
import { buildLeadSyncAlerts, formatLeadSyncAlerts } from "@/lib/public-forms/lead-sync-alerts"
import type { PublicFormAnswerInput, PublicFormSnapshot, PublicFormSubmissionInput } from "@/lib/public-forms/types"
import {
  extractLeadDataFromSnapshot,
  findMatchingLead,
  upsertLeadFromFormAnswers,
} from "./publicFormLeadSync"
import { syncPublicFormMetricToRadarInline } from "@/app/api/useCases/radar/syncPublicFormMetricToRadarInline"
import { FORM_COMPLETE_ACTIVITY_BODY } from "@/lib/public-forms/email-campaign-attribution"
import {
  buildPublicFormMetricEventKey,
} from "@/lib/public-forms/metric-keys"
import { resolveEmailCampaignFormAttributionUseCase } from "@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase"
import { isValidPublicFormId } from "@/lib/public-forms/validation"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/** Após este prazo, um `processing` é considerado stale e pode ser reenfileirado. */
const STALE_PROCESSING_MS = 2 * 60_000

export type PublicFormSubmissionBackgroundJob = {
  submissionId: string
  publicationId: string
  snapshot: PublicFormSnapshot
  visibleAnswers: PublicFormAnswerInput[]
  visibleIds: string[]
  score: number
  scoreBandLabel: string | null
  bandNote?: string[]
  origin: Record<string, unknown>
  requestKey: string
  visitorSessionId?: string | null
  thankYouPageId?: string | null
  scheduling?: PublicFormSubmissionInput["scheduling"]
}

function mapAnswersForPersistence(
  snapshot: PublicFormSnapshot,
  visibleAnswers: PublicFormAnswerInput[],
) {
  return visibleAnswers.map((answer) => {
    const question = snapshot.questions.find((item) => item.id === answer.questionId)
    if (!question) throw new Error("Snapshot de pergunta não encontrado")
    return {
      questionId: answer.questionId,
      value: answer.value as Prisma.InputJsonValue,
      questionSnapshot: json(question),
    }
  })
}

/** D19-B-bis: anexa score da submissão ao origin do evento form_completed (Radar metadata). */
function withFormCompletedScoreOrigin(
  origin: Record<string, unknown>,
  score: number,
  scoreBandLabel: string | null | undefined
): Record<string, unknown> {
  return {
    ...origin,
    submissionScorePercent: score,
    ...(scoreBandLabel ? { scoreBandLabel } : {}),
  }
}

export class PublicFormSubmissionUseCase {
  async accept(publicId: string, input: PublicFormSubmissionInput): Promise<Output> {
    if (!isValidPublicFormId(publicId)) return new Output(false, [], ["Formulário indisponível"], null)
    const current = (await publicFormsService.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return new Output(false, [], ["Formulário indisponível"], null)

    const existing = await publicFormsRepository.findSubmissionByRequestKey(input.requestKey)
    if (existing && existing.publicationId !== current.publicationId) {
      return new Output(
        false,
        [],
        ["Chave de requisição já utilizada em outro formulário"],
        null,
      )
    }

    if (existing?.status === "completed") {
      return new Output(true, ["Respostas já recebidas"], [], {
        submissionId: existing.id,
        alreadyProcessed: true,
      })
    }

    if (input.visitorSessionId) {
      const completedBySession = await publicFormsRepository.findCompletedSubmissionBySession(
        current.publicationId,
        input.visitorSessionId,
      )
      if (completedBySession) {
        return new Output(true, ["Respostas já recebidas"], [], {
          submissionId: completedBySession.id,
          alreadyProcessed: true,
        })
      }
    }

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
    const bandNote = band
      ? [`Qualificação: ${band.label}${band.summary ? ` — ${band.summary}` : ""}`]
      : undefined

    const answers = mapAnswersForPersistence(snapshot, visibleAnswers)

    // Retry: só reenfileira após claim atômico (failed ou processing stale).
    if (existing) {
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS)
      const claimed = await publicFormsRepository.claimSubmissionForRetry(
        existing.id,
        current.publicationId,
        staleBefore,
      )
      if (!claimed) {
        return new Output(true, ["Respostas já recebidas"], [], {
          submissionId: existing.id,
          alreadyProcessed: true,
        })
      }

      await publicFormsRepository.persistSubmissionAnswers(existing.id, answers)
      const background: PublicFormSubmissionBackgroundJob = {
        submissionId: existing.id,
        publicationId: current.publicationId,
        snapshot,
        visibleAnswers,
        visibleIds: [...visible],
        score,
        scoreBandLabel: band?.label ?? null,
        bandNote,
        origin: origin as Record<string, unknown>,
        requestKey: input.requestKey,
        visitorSessionId: input.visitorSessionId ?? existing.visitorSessionId ?? null,
        thankYouPageId: input.thankYouPageId ?? null,
        scheduling: input.scheduling,
      }
      return new Output(true, ["Respostas recebidas"], [], {
        submissionId: existing.id,
        alreadyProcessed: false,
        background,
      })
    }

    const progressSubmission =
      input.visitorSessionId != null
        ? await publicFormsRepository.findProgressSubmission(
            current.publicationId,
            input.visitorSessionId,
          )
        : null

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

    await publicFormsRepository.persistSubmissionAnswers(submission.id, answers)

    const background: PublicFormSubmissionBackgroundJob = {
      submissionId: submission.id,
      publicationId: current.publicationId,
      snapshot,
      visibleAnswers,
      visibleIds: [...visible],
      score,
      scoreBandLabel: band?.label ?? null,
      bandNote,
      origin: origin as Record<string, unknown>,
      requestKey: input.requestKey,
      visitorSessionId: input.visitorSessionId ?? null,
      thankYouPageId: input.thankYouPageId ?? null,
      scheduling: input.scheduling,
    }

    return new Output(true, ["Respostas recebidas"], [], {
      submissionId: submission.id,
      alreadyProcessed: false,
      background,
    })
  }

  async processInBackground(job: PublicFormSubmissionBackgroundJob): Promise<void> {
    const visible = new Set(job.visibleIds)
    const answers = mapAnswersForPersistence(job.snapshot, job.visibleAnswers)
    const alerts: string[] = []

    try {
      const form = await publicFormsRepository.findFormSubmissionContext(job.snapshot.formId)

      const attribution = await resolveEmailCampaignFormAttributionUseCase.execute({
        teamId: form.teamId,
        formId: form.id,
        formName: form.name,
        formPublicId: form.publicId,
        publicationId: job.publicationId,
        emailCampaignTrackingEnabled: form.emailCampaignTrackingEnabled,
        eventType: "form_completed",
        origin: job.origin,
        visitorSessionId: (job.visitorSessionId ?? job.requestKey).slice(0, 100),
      })
      const attributionResult = attribution.isValid
        ? (attribution.result as {
            leadId: string | null
            enrichedOrigin: Record<string, unknown>
          } | null)
        : null
      const origin = attributionResult?.enrichedOrigin
        ? sanitizePublicFormOrigin(attributionResult.enrichedOrigin)
        : job.origin

      const extracted = extractLeadDataFromSnapshot(job.snapshot, job.visibleAnswers, visible)
      const match = await findMatchingLead(form.teamId, extracted)
      alerts.push(...buildLeadSyncAlerts(extracted, match))

      const upserted = await upsertLeadFromFormAnswers({
        form,
        snapshot: job.snapshot,
        answers: job.visibleAnswers,
        visibleIds: visible,
        score: job.score,
        scoreBandLabel: job.scoreBandLabel,
        submissionId: job.submissionId,
        publicationId: job.publicationId,
        origin,
        extraNotes: job.bandNote,
      })

      const lead = upserted?.lead ?? null
      const resolvedLeadId = lead?.id ?? attributionResult?.leadId ?? null

      let scheduled = false
      if (lead && job.scheduling) {
        try {
          scheduled = await this.scheduleMeeting({
            form,
            snapshot: job.snapshot,
            lead,
            scheduling: job.scheduling,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao agendar reunião"
          console.error("[PublicFormSubmissionUseCase][processInBackground] Agendamento", message)
          alerts.push(message)
        }
      } else if (job.scheduling && !lead) {
        alerts.push("Agendamento não realizado: lead não vinculado")
      }

      const visitorSessionId = (job.visitorSessionId ?? job.requestKey).slice(0, 100)
      const metricOrigin = origin as Prisma.InputJsonValue
      const formCompletedOrigin = withFormCompletedScoreOrigin(
        origin,
        job.score,
        job.scoreBandLabel
      ) as Prisma.InputJsonValue
      const metricEvents: Array<{
        formId: string
        publicationId: string
        visitorSessionId: string
        eventType: "form_completed" | "lead_created" | "lead_attached" | "meeting_scheduled"
        eventKey: string
        origin: Prisma.InputJsonValue
        radarOrigin?: Record<string, unknown>
      }> = [
        {
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType: "form_completed",
          eventKey: buildPublicFormMetricEventKey(visitorSessionId, "form_completed"),
          origin: formCompletedOrigin,
          radarOrigin: withFormCompletedScoreOrigin(origin, job.score, job.scoreBandLabel),
        },
      ]

      if (lead || attributionResult?.leadId) {
        const eventType = upserted?.created
          ? ("lead_created" as const)
          : ("lead_attached" as const)
        metricEvents.push({
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType,
          eventKey: buildPublicFormMetricEventKey(visitorSessionId, eventType),
          origin: metricOrigin,
        })
      }

      if (scheduled) {
        metricEvents.push({
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType: "meeting_scheduled",
          eventKey: buildPublicFormMetricEventKey(visitorSessionId, "meeting_scheduled"),
          origin: metricOrigin,
        })
      }

      await publicFormsRepository.completeSubmission({
        submissionId: job.submissionId,
        leadId: resolvedLeadId,
        processingAlerts: formatLeadSyncAlerts(alerts),
        answers,
        activityBody: resolvedLeadId ? FORM_COMPLETE_ACTIVITY_BODY : undefined,
        activityPayload: resolvedLeadId
          ? json({
              kind: "public_form_completed",
              formId: job.snapshot.formId,
              formName: form.name,
              formPublicId: form.publicId,
              publicationId: job.publicationId,
              publicationVersion: job.snapshot.version,
              submissionId: job.submissionId,
              thankYouPageId: job.thankYouPageId ?? null,
              score: job.score,
              scoreBand: job.scoreBandLabel,
              origin,
              emailLogId:
                typeof origin.emailLogId === "string" ? origin.emailLogId : null,
              campaignId:
                typeof origin.campaignId === "string" ? origin.campaignId : null,
            })
          : undefined,
        metricEvents,
      })

      for (const event of metricEvents) {
        syncPublicFormMetricToRadarInline({
          teamId: form.teamId,
          eventType: event.eventType,
          eventKey: event.eventKey,
          visitorSessionId: event.visitorSessionId,
          formId: event.formId,
          publicationId: event.publicationId,
          leadId: resolvedLeadId,
          origin: event.radarOrigin ?? origin,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar respostas"
      console.error("[PublicFormSubmissionUseCase][processInBackground]", message)
      alerts.push(message)
      const fallbackVisitorSessionId = (job.visitorSessionId ?? job.requestKey).slice(0, 100)
      const fallbackOrigin = withFormCompletedScoreOrigin(
        job.origin,
        job.score,
        job.scoreBandLabel
      )
      const fallbackMetricEvents = [
        {
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId: fallbackVisitorSessionId,
          eventType: "form_completed" as const,
          eventKey: buildPublicFormMetricEventKey(fallbackVisitorSessionId, "form_completed"),
          origin: fallbackOrigin as Prisma.InputJsonValue,
        },
      ]
      await publicFormsRepository.completeSubmission({
        submissionId: job.submissionId,
        leadId: null,
        processingAlerts: formatLeadSyncAlerts(alerts),
        answers,
        metricEvents: fallbackMetricEvents,
      })

      const teamCtx = await publicFormsRepository.findAvailabilityTeamContext(job.snapshot.formId)
      if (teamCtx?.teamId) {
        for (const event of fallbackMetricEvents) {
          syncPublicFormMetricToRadarInline({
            teamId: teamCtx.teamId,
            eventType: event.eventType,
            eventKey: event.eventKey,
            visitorSessionId: event.visitorSessionId,
            formId: event.formId,
            publicationId: event.publicationId,
            origin: fallbackOrigin,
          })
        }
      }
    }
  }

  private async scheduleMeeting(input: {
    form: Awaited<ReturnType<typeof publicFormsRepository.findFormSubmissionContext>>
    snapshot: PublicFormSnapshot
    lead: Lead
    scheduling: NonNullable<PublicFormSubmissionInput["scheduling"]>
  }) {
    const { form, snapshot, lead, scheduling } = input
    if (!snapshot.schedulingEnabled || snapshot.eligibleCloserIds.length === 0) {
      throw new Error("Agendamento indisponível para este formulário")
    }

    const timezone = form.team.master.timezone || DEFAULT_TZ
    const startsAt = new Date(scheduling.startsAt)
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
        (availabilityOutput.result as { availableTimes?: string[] } | null)?.availableTimes ?? []
      if (availableTimes.includes(timeKey)) availableCloserIds.push(closerId)
    }
    if (availableCloserIds.length === 0) {
      throw new Error("O horário selecionado não está mais disponível")
    }

    const closerId = availableCloserIds[Math.floor(Math.random() * availableCloserIds.length)]!
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
      meetingDate: scheduling.startsAt,
      meetingTitle: `Reunião — ${lead.name}`,
      meetingNotes: snapshot.schedulingMessage ?? undefined,
      meetingType,
      durationMinutes: snapshot.meetingDurationMinutes,
      createdByProfileId: form.team.master.id,
      transitionStatusToScheduled: true,
      authorAsStudio: true,
    })
    if (!scheduleOutput.isValid) throw new Error(scheduleOutput.errorMessages.join("; "))
    return true
  }
}

export const publicFormSubmissionUseCase = new PublicFormSubmissionUseCase()
