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
import { leadFromUpsertOutcome } from "@/lib/public-forms/lead-upsert-outcome"
import { isValidPublicFormId } from "@/lib/public-forms/validation"
import {
  buildPublicFormIdentityGateIdempotencyKey,
  buildPublicFormQuestionAnsweredEventKey,
} from "@/lib/public-forms/metric-keys"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"
import {
  legacyPublicFormProgressLeadService,
  type ILegacyPublicFormProgressLeadService,
} from "@/app/api/services/PublicForms/LegacyPublicFormProgressLeadService"
import {
  resolvePublicFormLeadGateMode,
  type PublicFormLeadGateMode,
} from "@/lib/public-forms/public-form-lead-gate-mode"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isLeadIdentityMappingKey(mappingKey: string | null | undefined): boolean {
  return mappingKey === "name" || mappingKey === "email" || mappingKey === "phone"
}

const MAX_FUTURE_OCCURRED_AT_MS = 5 * 60_000

/** Contrato v1: `occurredAt` inválido ou >5min no futuro é normalizado para o horário de recebimento. */
function resolveProgressAnsweredAt(occurredAt: string | undefined): Date {
  if (!occurredAt) return new Date()
  const parsed = new Date(occurredAt)
  if (Number.isNaN(parsed.getTime())) return new Date()
  if (parsed.getTime() - Date.now() > MAX_FUTURE_OCCURRED_AT_MS) return new Date()
  return parsed
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
  constructor(
    private readonly legacyLeadCreator: ILegacyPublicFormProgressLeadService =
      legacyPublicFormProgressLeadService,
    private readonly resolveLeadGateMode: (
      teamId: string,
    ) => PublicFormLeadGateMode = resolvePublicFormLeadGateMode,
  ) {}

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
    let sessionLeadId: string | null = resolved.sessionSubmission?.leadId ?? null
    const leadGateMode = this.resolveLeadGateMode(form.teamId)
    // SPEC 40 E4/DA4 (review #1043): o guard dentro do sync de lead sozinho não
    // bastava. Aqui há um segundo caminho que produz lead — o criador legado do
    // progresso — e um terceiro, o `createCrmLead` que arma o gate C do Radar
    // mais abaixo. Formulário de pesquisa não promove por nenhum deles.
    const leadCaptureEnabled = !snapshot.leadCaptureDisabled
    if (leadGateMode !== "radar" && leadCaptureEnabled) {
      const legacyLead = await this.legacyLeadCreator.createOrUpdate({
        form,
        snapshot,
        answers: visibleAnswers,
        visibleIds: visible,
        publicationId,
        origin,
        allowCreate: !sessionLeadId,
      })
      // O descarte NÃO é emitido aqui de propósito (SPEC 40 E2, divergência
      // registrada na nota): `/progress` dispara a cada blur, e a parcial que
      // ainda não tem telefone vira lead assim que o visitante digitar. Emitir
      // agora deixaria uma linha de descarte para uma sessão que converte —
      // quebrando exatamente a conta de T-F2.3. O descarte nasce no
      // completamento, junto do `form_completed`, que é onde o par é medido.
      sessionLeadId = leadFromUpsertOutcome(legacyLead)?.id ?? sessionLeadId
    }
    const answeredAt = resolveProgressAnsweredAt(input.occurredAt)
    const incomingQuestionIds = new Set(incomingAnswers.map((answer) => answer.questionId))
    const answerPayload = mapAnswersForPersistence(snapshot, visibleAnswers).map((answer) =>
      incomingQuestionIds.has(answer.questionId)
        ? {
            ...answer,
            answeredAt,
            sourceEventId: input.eventId ?? null,
            mappingKey:
              snapshot.questions.find((question) => question.id === answer.questionId)
                ?.mappingKey ?? null,
          }
        : answer,
    )

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
        // Envelope causal v1: o mesmo `eventId` acompanha a revisão até a
        // materialização no Radar, permitindo dedupe e ordenação por
        // `(occurredAt, eventId)` no consumer.
        schemaVersion: input.schemaVersion,
        eventId: input.eventId,
        occurredAt: answeredAt.toISOString(),
        origin: origin as Record<string, unknown>,
        answerMappingKey: mappingKey,
        answerValue,
        createCrmLead: leadCaptureEnabled && isIdentityAnswer && Boolean(identityAnswerValue),
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
