import { Prisma } from "@prisma/client"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { publicFormsService } from "@/app/api/services/PublicForms/PublicFormsService"
import { Output } from "@/lib/output"
import { isEmailCampaignFormOrigin, sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import { resolveVisibleQuestionIds } from "@/lib/public-forms/engine"
import type { PublicFormProgressInput, PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  upsertLeadFromFormAnswers,
} from "./publicFormLeadSync"
import { isValidPublicFormId } from "@/lib/public-forms/validation"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export class PublicFormProgressUseCase {
  async execute(publicId: string, input: PublicFormProgressInput): Promise<Output> {
    if (!isValidPublicFormId(publicId)) return new Output(false, [], ["Formulário indisponível"], null)
    const current = (await publicFormsService.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return new Output(false, [], ["Formulário indisponível"], null)

    const { snapshot } = current
    const visible = new Set(resolveVisibleQuestionIds(snapshot, input.answers))
    const visibleAnswers = input.answers.filter((answer) => visible.has(answer.questionId))
    const origin = sanitizePublicFormOrigin(input.origin ?? {})
    const extracted = extractLeadDataFromSnapshot(snapshot, visibleAnswers, visible)

    let completionStatus: "initial" | "partial" = "initial"
    if (visibleAnswers.length > 0) {
      completionStatus =
        canCreateLeadFromExtracted(extracted) || canUpdateLeadFromExtracted(extracted)
          ? "partial"
          : "initial"
    }

    const requestKey = `progress:${input.visitorSessionId}:${current.publicationId}`
    const form = await publicFormsRepository.findFormSubmissionContext(snapshot.formId)

    let leadId: string | null = null
    try {
      const upserted = await upsertLeadFromFormAnswers({
        form,
        snapshot,
        answers: visibleAnswers,
        visibleIds: visible,
        publicationId: current.publicationId,
        origin: origin as Record<string, unknown>,
        allowCreate: !isEmailCampaignFormOrigin(origin),
      })
      leadId = upserted?.lead.id ?? null
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar lead"
      console.error("[PublicFormProgressUseCase][execute]", message)
    }

    const answerPayload = visibleAnswers.map((answer) => {
      const question = snapshot.questions.find((item) => item.id === answer.questionId)
      if (!question) throw new Error("Snapshot de pergunta não encontrado")
      return {
        questionId: answer.questionId,
        value: answer.value as Prisma.InputJsonValue,
        questionSnapshot: json(question),
      }
    })

    const submission = await publicFormsRepository.upsertProgressSubmission({
      formId: snapshot.formId,
      publicationId: current.publicationId,
      visitorSessionId: input.visitorSessionId,
      requestKey,
      origin: origin as Prisma.InputJsonValue,
      completionStatus,
      leadId,
      answers: answerPayload,
    })

    for (const answer of visibleAnswers) {
      const eventKey = `${input.visitorSessionId}:progress:${answer.questionId}`
      await publicFormsRepository.upsertMetricEvent({
        formId: snapshot.formId,
        publicationId: current.publicationId,
        questionId: answer.questionId,
        visitorSessionId: input.visitorSessionId,
        eventType: "question_answered",
        eventKey,
        origin: {
          ...(origin as Record<string, unknown>),
          answerValue: answer.value,
        } as Prisma.InputJsonValue,
      })
      await publishServerPublicFormMetricEvent(
        buildPublicFormMetricQueuePayload(form.publicId, {
          visitorSessionId: input.visitorSessionId,
          eventType: "question_answered",
          questionId: answer.questionId,
          eventKey,
          origin: {
            ...(origin as Record<string, unknown>),
            answerValue: answer.value,
          },
        }),
        "PublicFormProgressUseCase",
      )
    }

    return new Output(
      true,
      [],
      [],
      {
        submissionId: submission.id,
        completionStatus,
        leadId,
      },
    )
  }
}

export const publicFormProgressUseCase = new PublicFormProgressUseCase()
