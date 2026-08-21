import { Prisma } from "@prisma/client"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { publicFormsService } from "@/app/api/services/PublicForms/PublicFormsService"
import { Output } from "@/lib/output"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import { resolveVisibleQuestionIds } from "@/lib/public-forms/engine"
import type {
  PublicFormMetricEventInput,
  PublicFormProgressInput,
  PublicFormSnapshot,
} from "@/lib/public-forms/types"
import { mergeProgressAnswers } from "@/lib/public-forms/merge-progress-answers"
import { mapAnswersForPersistence } from "@/lib/public-forms/publication-snapshot"
import { resolvePublicFormPublicationForVisitor } from "@/lib/public-forms/resolve-form-publication"
import {
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
  isBlankPublicFormAnswerValue,
  publicFormAnswerValueText,
} from "./publicFormLeadSync"
import { isValidPublicFormId } from "@/lib/public-forms/validation"
import {
  buildPublicFormIdentityGateIdempotencyKey,
  buildPublicFormQuestionAnsweredEventKey,
} from "@/lib/public-forms/metric-keys"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isLeadIdentityMappingKey(mappingKey: string | null | undefined): boolean {
  return mappingKey === "name" || mappingKey === "email" || mappingKey === "phone"
}

/** Fila OIDC/CI costuma falhar; o consumer não roda. Radar fecha A+C neste isolate. */
async function processQuestionAnsweredWhenQueueUnavailable(
  publicId: string,
  input: PublicFormMetricEventInput,
): Promise<void> {
  const accepted = await publicFormsService.recordMetric(publicId, input, { radarMode: "inline" })
  if (!accepted) {
    throw new Error("Falha ao persistir evento de resposta no fallback do Radar")
  }
}

export class PublicFormProgressUseCase {
  async execute(publicId: string, input: PublicFormProgressInput): Promise<Output> {
    if (!isValidPublicFormId(publicId))
      return new Output(false, [], ["Formulário indisponível"], null)
    const current = (await publicFormsService.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return new Output(false, [], ["Formulário indisponível"], null)

    const resolved = await resolvePublicFormPublicationForVisitor({
      current,
      visitorSessionId: input.visitorSessionId,
      questionIds: input.answers.map((answer) => answer.questionId),
    })
    if (resolved.sessionSubmission?.status === "completed") {
      return new Output(true, [], [], {
        submissionId: resolved.sessionSubmission.id,
        completionStatus: "complete",
      })
    }

    const { snapshot, publicationId } = resolved
    const storedAnswers = resolved.sessionSubmission
      ? await publicFormsRepository.listSubmissionAnswers(resolved.sessionSubmission.id)
      : []
    const mergedAnswers = mergeProgressAnswers({
      stored: storedAnswers,
      incoming: input.answers,
    })
    const visible = new Set(resolveVisibleQuestionIds(snapshot, mergedAnswers))
    const visibleAnswers = mergedAnswers.filter((answer) => visible.has(answer.questionId))
    const incomingAnswers = input.answers.filter((answer) => visible.has(answer.questionId))
    const origin = sanitizePublicFormOrigin(input.origin ?? {})
    const extracted = extractLeadDataFromSnapshot(snapshot, visibleAnswers, visible)

    let completionStatus: "initial" | "partial" = "initial"
    if (visibleAnswers.length > 0) {
      completionStatus =
        hasCrmGateAC(extracted) || canUpdateLeadFromExtracted(extracted) ? "partial" : "initial"
    }

    const requestKey = `progress:${input.visitorSessionId}:${publicationId}`
    const form = await publicFormsRepository.findFormSubmissionContext(snapshot.formId)
    const sessionLeadId: string | null = resolved.sessionSubmission?.leadId ?? null
    const answerPayload = mapAnswersForPersistence(snapshot, visibleAnswers)

    const submission = await publicFormsRepository.upsertProgressSubmission({
      formId: snapshot.formId,
      publicationId,
      visitorSessionId: input.visitorSessionId,
      requestKey,
      origin: origin as Prisma.InputJsonValue,
      completionStatus,
      leadId: sessionLeadId,
      answers: answerPayload,
    })

    for (const answer of incomingAnswers) {
      if (isBlankPublicFormAnswerValue(answer.value)) continue
      const question = snapshot.questions.find((item) => item.id === answer.questionId)
      const eventKey = buildPublicFormQuestionAnsweredEventKey(
        input.visitorSessionId,
        answer.questionId,
      )
      const answerValue = answer.value
      const identityAnswerValue = publicFormAnswerValueText(answer.value)
      const mappingKey = question?.mappingKey ?? null
      const isIdentityAnswer = isLeadIdentityMappingKey(mappingKey)
      await publicFormsRepository.upsertMetricEvent({
        formId: snapshot.formId,
        publicationId,
        questionId: answer.questionId,
        questionSnapshot: question ? json(question) : null,
        visitorSessionId: input.visitorSessionId,
        eventType: "question_answered",
        eventKey,
        origin: origin as Prisma.InputJsonValue,
      })
      const metricInput: PublicFormMetricEventInput = {
        visitorSessionId: input.visitorSessionId,
        eventType: "question_answered",
        questionId: answer.questionId,
        eventKey,
        origin: origin as Record<string, unknown>,
        answerMappingKey: mappingKey,
        answerValue,
        createCrmLead: isIdentityAnswer && Boolean(identityAnswerValue),
      }
      const queued = await publishServerPublicFormMetricEvent(
        buildPublicFormMetricQueuePayload(form.publicId, metricInput),
        "PublicFormProgressUseCase",
        isIdentityAnswer && identityAnswerValue
          ? {
              idempotencyKey: buildPublicFormIdentityGateIdempotencyKey(
                eventKey,
                identityAnswerValue,
              ),
            }
          : undefined,
      )
      if (queued === false) {
        await processQuestionAnsweredWhenQueueUnavailable(form.publicId, metricInput)
      }
      console.info("[PublicFormProgressUseCase][execute] campo recebido", {
        publicId: form.publicId,
        visitorSessionId: input.visitorSessionId,
        questionId: answer.questionId,
        mappingKey,
        mappingTarget: question?.mappingTarget ?? null,
      })
    }

    return new Output(true, [], [], {
      submissionId: submission.id,
      completionStatus,
    })
  }
}

export const publicFormProgressUseCase = new PublicFormProgressUseCase()
