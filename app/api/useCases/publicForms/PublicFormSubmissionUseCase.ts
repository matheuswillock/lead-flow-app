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
  validateAnswerIssue,
} from "@/lib/public-forms/engine"
import { buildLeadSyncAlerts, formatLeadSyncAlerts } from "@/lib/public-forms/lead-sync-alerts"
import { invalidateLeadCache } from "@/lib/cache/invalidation"
import type {
  PublicFormAnswerInput,
  PublicFormSnapshot,
  PublicFormSubmissionInput,
} from "@/lib/public-forms/types"
import {
  mapAnswersForPersistence,
  parsePublicFormSnapshot,
} from "@/lib/public-forms/publication-snapshot"
import { resolvePublicFormPublicationForVisitor } from "@/lib/public-forms/resolve-form-publication"
import {
  extractLeadDataFromSnapshot,
  findMatchingLead,
  upsertLeadFromFormAnswers,
} from "./publicFormLeadSync"
// Direto do módulo puro, não do `publicFormLeadSync`: função pura de identidade,
// e assim os testes que trocam o módulo de sync inteiro por mock continuam
// enxergando a regra (mesma razão de `leadFromUpsertOutcome`).
import { resolveLeadDiscardReason } from "@/lib/public-forms/lead-identity"
import {
  leadFromUpsertOutcome,
  type UpsertLeadOutcome,
} from "@/lib/public-forms/lead-upsert-outcome"
import {
  FORM_COMPLETE_ACTIVITY_BODY,
  parseEmailLogIdFromOrigin,
} from "@/lib/public-forms/email-campaign-attribution"
import {
  buildPublicFormLeadDiscardedEventKey,
  buildPublicFormMetricEventKey,
  buildPublicFormServerValidationFailedEventKey,
} from "@/lib/public-forms/metric-keys"
import { resolveEmailCampaignFormAttributionUseCase } from "@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase"
import { isValidPublicFormId } from "@/lib/public-forms/validation"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"
import { queueSubmissionForBackgroundProcessing } from "@/lib/public-forms/queue-submission-for-background-processing"
import { resolvePublicFormLeadGateMode } from "@/lib/public-forms/public-form-lead-gate-mode"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/** Após este prazo, um `processing` é considerado stale e pode ser reenfileirado. */
const STALE_PROCESSING_MS = 2 * 60_000

export type PublicFormSubmissionBackgroundJob = {
  submissionId: string
  publicationId: string
  eventId?: string | null
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

/** D19-B-bis: anexa score da submissão ao origin do evento form_completed (Radar metadata). */
function withFormCompletedScoreOrigin(
  origin: Record<string, unknown>,
  score: number,
  scoreBandLabel: string | null | undefined,
): Record<string, unknown> {
  return {
    ...origin,
    submissionScorePercent: score,
    ...(scoreBandLabel ? { scoreBandLabel } : {}),
  }
}

export class PublicFormSubmissionUseCase {
  async accept(publicId: string, input: PublicFormSubmissionInput): Promise<Output> {
    if (!isValidPublicFormId(publicId))
      return new Output(false, [], ["Formulário indisponível"], null)
    const current = (await publicFormsService.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return new Output(false, [], ["Formulário indisponível"], null)

    const existing = await publicFormsRepository.findSubmissionByRequestKey(input.requestKey)
    if (existing && existing.formId !== current.snapshot.formId) {
      return new Output(false, [], ["Chave de requisição já utilizada em outro formulário"], null)
    }

    if (existing?.status === "completed") {
      return new Output(true, ["Respostas já recebidas"], [], {
        submissionId: existing.id,
        alreadyProcessed: true,
      })
    }

    // Atribuição da requisição atual. O `accept()` tem TRÊS curto-circuitos de
    // "Respostas já recebidas" — requestKey, sessão resolvida pela publicação, e
    // sessão na publicação corrente — e todos precisam concordar em o que conta
    // como "a mesma conversão". O cookie de sessão vive 30 dias, então o mesmo
    // navegador pode converter por campanhas diferentes; sem comparar a
    // atribuição, a segunda é engolida por um dos gates e não gera métrica
    // nenhuma. Basta um deles ficar de fora para o buraco continuar aberto.
    const currentAttribution = parseEmailLogIdFromOrigin(input.origin ?? {})
    const isSameConversion = (submissionOrigin: unknown): boolean =>
      parseEmailLogIdFromOrigin((submissionOrigin as Record<string, unknown> | null) ?? {}) ===
      currentAttribution

    let publicationId = current.publicationId
    let snapshot = current.snapshot

    if (existing) {
      const pinned = await publicFormsRepository.findPublicationById(existing.publicationId)
      const pinnedSnapshot = pinned ? parsePublicFormSnapshot(pinned.snapshot) : null
      if (pinned && pinnedSnapshot) {
        publicationId = pinned.publicationId
        snapshot = pinnedSnapshot
      }
    } else {
      const resolved = await resolvePublicFormPublicationForVisitor({
        current,
        visitorSessionId: input.visitorSessionId,
        questionIds: input.answers.map((answer) => answer.questionId),
      })
      // Este gate roda ANTES do de baixo e usa a última submissão da sessão no
      // form inteiro, não só na publicação corrente. Sem a checagem de
      // atribuição aqui, o `requestKey` escopado não adianta nada: a campanha
      // nova não casa nenhum requestKey, cai neste `else`, e sai por aqui.
      if (
        resolved.sessionSubmission?.status === "completed" &&
        isSameConversion(resolved.sessionSubmission.origin)
      ) {
        return new Output(true, ["Respostas já recebidas"], [], {
          submissionId: resolved.sessionSubmission.id,
          alreadyProcessed: true,
        })
      }
      publicationId = resolved.publicationId
      snapshot = resolved.snapshot
    }

    if (input.visitorSessionId) {
      const completedBySession = await publicFormsRepository.findCompletedSubmissionBySession(
        publicationId,
        input.visitorSessionId,
      )
      // Mesma regra do gate acima: só é a MESMA conversão quando a atribuição
      // bate. Preserva a idempotência real — recarregar ou reenviar pelo MESMO
      // link continua barrado — e libera o que de fato é conversão distinta.
      if (completedBySession && isSameConversion(completedBySession.origin)) {
        return new Output(true, ["Respostas já recebidas"], [], {
          submissionId: completedBySession.id,
          alreadyProcessed: true,
        })
      }
    }

    // E1/DA1: a obrigatoriedade é invariante do servidor. Roda sobre o snapshot
    // da publicação DESTA submissão (nunca o rascunho atual), com o mesmo motor
    // do cliente — a regra é uma só. `answerMap` só tem as respostas visíveis,
    // então pergunta ausente entra como `undefined` e cai no código `required`.
    const visible = new Set(resolveVisibleQuestionIds(snapshot, input.answers))
    const visibleAnswers = input.answers.filter((answer) => visible.has(answer.questionId))
    const answerMap = new Map(visibleAnswers.map((answer) => [answer.questionId, answer.value]))
    const issues = snapshot.questions.flatMap((question) => {
      if (!visible.has(question.id)) return []
      const issue = validateAnswerIssue(question, answerMap.get(question.id))
      if (!issue) return []
      return [
        {
          questionId: question.id,
          code: issue.code,
          message: `${question.title}: ${issue.message}`,
        },
      ]
    })
    if (issues.length > 0) {
      await this.recordServerValidationFailure({
        publicId,
        formId: snapshot.formId,
        // A publicação já pinada acima — a mesma contra a qual o 422 validou.
        publicationId,
        visitorSessionId: input.visitorSessionId ?? input.requestKey,
        origin: input.origin ?? {},
        issues: issues.map(({ questionId, code }) => ({ questionId, code })),
      })
      return new Output(
        false,
        [],
        issues.map((issue) => issue.message),
        {
          validation: issues.map(({ questionId, code }) => ({ questionId, code })),
        },
      )
    }

    const score = calculatePublicFormScorePercent(snapshot, visibleAnswers)
    const band = snapshot.scoreBands.find(
      (item) => score >= item.minScore && score <= item.maxScore,
    )
    const origin = sanitizePublicFormOrigin(input.origin)
    const bandNote = band
      ? [`Qualificação: ${band.label}${band.summary ? ` — ${band.summary}` : ""}`]
      : undefined

    const answers = mapAnswersForPersistence(snapshot, visibleAnswers)

    // DA6: o aceite é gravado aqui, junto da própria escrita da submissão —
    // síncrono, antes de qualquer enfileiramento — e é o único fato que
    // autoriza o cron de re-despacho a tocar nesta linha. Reenvio do mesmo
    // `requestKey` preserva o primeiro carimbo (first-write-wins), então o
    // marcador conta quando o visitante enviou, não quando o retry rodou.
    const submitRequestedAt = new Date()

    // Retry: só reenfileira após claim atômico (failed ou processing stale).
    if (existing) {
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS)
      const claimed = await publicFormsRepository.claimSubmissionForRetry({
        submissionId: existing.id,
        publicationId,
        staleBefore,
        submitRequestedAt: existing.submitRequestedAt ?? submitRequestedAt,
      })
      if (!claimed) {
        return new Output(true, ["Respostas já recebidas"], [], {
          submissionId: existing.id,
          alreadyProcessed: true,
        })
      }

      await publicFormsRepository.persistSubmissionAnswers(existing.id, answers)
      const background: PublicFormSubmissionBackgroundJob = {
        submissionId: existing.id,
        publicationId,
        eventId: input.eventId ?? existing.eventId,
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
        ? await publicFormsRepository.findProgressSubmission(publicationId, input.visitorSessionId)
        : null

    const dispatchContext = {
      thankYouPageId: input.thankYouPageId ?? null,
      scheduledMeetingStartsAt: input.scheduling ? new Date(input.scheduling.startsAt) : null,
    }
    const submission = progressSubmission
      ? await publicFormsRepository.finalizeProgressSubmission(progressSubmission.id, {
          requestKey: input.requestKey,
          eventId: input.eventId,
          score,
          scoreBandLabel: band?.label,
          origin: origin as Prisma.InputJsonValue,
          visitorSessionId: input.visitorSessionId ?? null,
          submitRequestedAt: progressSubmission.submitRequestedAt ?? submitRequestedAt,
          ...dispatchContext,
        })
      : await publicFormsRepository.createSubmission({
          formId: snapshot.formId,
          publicationId,
          requestKey: input.requestKey,
          eventId: input.eventId,
          visitorSessionId: input.visitorSessionId ?? null,
          score,
          scoreBandLabel: band?.label,
          origin: origin as Prisma.InputJsonValue,
          completionStatus: "partial",
          submitRequestedAt,
          ...dispatchContext,
        })

    await publicFormsRepository.persistSubmissionAnswers(submission.id, answers)

    const background: PublicFormSubmissionBackgroundJob = {
      submissionId: submission.id,
      publicationId,
      eventId: input.eventId ?? submission.eventId,
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

  /**
   * E1: a recusa do servidor vira linha de funil. `origin.source = "server"`
   * separa esta métrica do `form_validation_failed` do renderer — sem isso o
   * funil não distingue "o cliente barrou antes de postar" de "o cliente postou
   * incompleto e o servidor devolveu 422".
   *
   * Vai pelo `recordMetric` do serviço, não direto no repositório (review
   * #1030): é ele que alimenta a projeção de jornada e faz o bridging para o
   * Radar. Escrever direto no repositório deixava o evento fora dos dois.
   *
   * O `publicationId` é passado explicitamente porque `recordMetric` resolveria
   * pela publicação **vigente**, e o 422 foi validado contra a publicação
   * pinada da submissão — sem isso a recusa aparece no funil da publicação
   * errada.
   *
   * Nunca derruba o 422: métrica que falha vira log, não erro de resposta.
   */
  private async recordServerValidationFailure(input: {
    publicId: string
    formId: string
    publicationId: string
    visitorSessionId: string
    origin: Record<string, unknown>
    issues: Array<{ questionId: string; code: string }>
  }): Promise<void> {
    const visitorSessionId = input.visitorSessionId.slice(0, 100)
    const emailLogId = parseEmailLogIdFromOrigin(input.origin)
    try {
      await publicFormsService.recordMetric(
        input.publicId,
        {
          visitorSessionId,
          eventType: "form_validation_failed",
          eventKey: buildPublicFormServerValidationFailedEventKey(
            input.formId,
            visitorSessionId,
            emailLogId,
          ),
          origin: { ...sanitizePublicFormOrigin(input.origin), source: "server" },
          // Só id e código — nunca o valor recusado (contrato do campo).
          validationCodes: input.issues,
        },
        { publicationId: input.publicationId },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao registrar recusa"
      console.error("[PublicFormSubmissionUseCase][recordServerValidationFailure]", message)
    }
  }

  async processInBackground(job: PublicFormSubmissionBackgroundJob): Promise<void> {
    const visible = new Set(job.visibleIds)
    const answers = mapAnswersForPersistence(job.snapshot, job.visibleAnswers)
    const alerts: string[] = []

    try {
      const form = await publicFormsRepository.findFormSubmissionContext(job.snapshot.formId)
      const leadGateMode = resolvePublicFormLeadGateMode(form.teamId)
      let attributionResult: {
        leadId: string | null
        enrichedOrigin: Record<string, unknown>
      } | null = null
      let origin = job.origin
      let upserted: UpsertLeadOutcome | null = null
      let lead: Lead | null = null

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
      if (!attribution.isValid) {
        throw new Error(
          attribution.errorMessages.join("; ") || "Falha ao atribuir formulário à campanha",
        )
      }
      attributionResult = attribution.result as {
        leadId: string | null
        enrichedOrigin: Record<string, unknown>
      } | null
      origin = attributionResult?.enrichedOrigin
        ? sanitizePublicFormOrigin(attributionResult.enrichedOrigin)
        : job.origin

      // Extração e match são idênticos nos dois modos — o que muda é só
      // `allowCreate`. Ficam aqui fora porque o motivo do descarte é decidido
      // no fim, sobre a identidade desta submissão, valendo para os dois.
      const extracted = extractLeadDataFromSnapshot(job.snapshot, job.visibleAnswers, visible)
      const match = await findMatchingLead(form.teamId, extracted)
      alerts.push(...buildLeadSyncAlerts(extracted, match))

      if (leadGateMode === "radar") {
        lead = await publicFormsRepository.findLeadForSubmission(job.submissionId)
      }
      upserted = await upsertLeadFromFormAnswers({
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
        ...(leadGateMode === "radar" ? { allowCreate: false } : {}),
      })
      lead = leadFromUpsertOutcome(upserted) ?? lead

      // SPEC 40 E4/DA4 (review #1043): a atribuição de campanha resolve um lead
      // pelo `cs_el` mesmo sem nenhuma resposta de identidade, e esse id
      // vazava para `lead_attached`, para o `leadId` da submissão e para a
      // activity — apesar do `upsertLeadFromFormAnswers` já sair mais cedo. A
      // atribuição continua rodando (o funil de campanha depende dela); o que
      // ela não faz mais é ligar lead num formulário de pesquisa.
      const leadCaptureEnabled = !job.snapshot.leadCaptureDisabled
      const resolvedLeadId = leadCaptureEnabled
        ? (lead?.id ?? attributionResult?.leadId ?? null)
        : null

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
      // Escopa a chave da métrica pela atribuição: sem isso, um destinatário que
      // já enviou o formulário antes mantém a linha antiga (upsert é
      // first-write-wins) e a conversão da campanha nova some ou fica creditada
      // à campanha anterior.
      const attributionEmailLogId =
        typeof origin.emailLogId === "string" ? origin.emailLogId : null
      const metricOrigin = origin as Prisma.InputJsonValue
      const formCompletedOrigin = withFormCompletedScoreOrigin(
        origin,
        job.score,
        job.scoreBandLabel,
      ) as Prisma.InputJsonValue
      const metricEvents: Array<{
        formId: string
        publicationId: string
        visitorSessionId: string
        eventType:
          | "form_completed"
          | "lead_created"
          | "lead_attached"
          | "lead_discarded"
          | "meeting_scheduled"
        eventKey: string
        origin: Prisma.InputJsonValue
        radarOrigin?: Record<string, unknown>
      }> = [
        {
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType: "form_completed",
          eventKey: buildPublicFormMetricEventKey(
            visitorSessionId,
            "form_completed",
            attributionEmailLogId
          ),
          origin: formCompletedOrigin,
          radarOrigin: withFormCompletedScoreOrigin(origin, job.score, job.scoreBandLabel),
        },
      ]

      // `resolvedLeadId` (E4/#1043) e `outcome` (E2/#1040): a condição é "sobrou
      // lead", que já respeita `leadCaptureDisabled`, e o tipo do evento vem do
      // desfecho nomeado do upsert.
      if (resolvedLeadId) {
        const eventType =
          upserted?.outcome === "created" ? ("lead_created" as const) : ("lead_attached" as const)

        // O lead do formulario publico nasce aqui, no processamento em
        // background — nao na rota de submissao, que so enfileira. Sem esta
        // invalidacao ele ficava invisivel no board ate o TTL do cache de
        // listagem, mesma classe do bug do webhook do Meta.
        if (resolvedLeadId && form.teamId) {
          invalidateLeadCache({ leadId: resolvedLeadId, teamId: form.teamId })
        }

        metricEvents.push({
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType,
          eventKey: buildPublicFormMetricEventKey(
            visitorSessionId,
            eventType,
            attributionEmailLogId
          ),
          origin: metricOrigin,
        })
      }

      // E2/DA2: o terceiro desfecho. Sem esta linha, `form_completed` sem lead
      // era silêncio — o motivo existia só como texto em `errorMessage`, que
      // não agrega, não alarma e não fecha o funil. O `eventKey` sai do
      // `requestKey` (único por submissão), então o drain reprocessando o mesmo
      // job colide no upsert em vez de dobrar o contador.
      //
      // A condição é `!resolvedLeadId`, não `upserted.outcome === "discarded"`.
      // Duas correções do review vêm daí: (a) atribuição por `cs_el` que já
      // resolveu um lead emite `lead_attached` — contar descarte junto faria a
      // mesma conclusão valer por dois desfechos; (b) no modo radar o upsert sai
      // como `skipped` (quem promove é o gate C), e checar só o outcome deixava
      // toda submissão de time canário sem par no funil.
      // `leadCaptureEnabled` entra aqui na união do E2 com o E4: com a captação
      // desligada não há lead **por decisão do dono do form**, e chamar isso de
      // descarte encheria o funil de um formulário de pesquisa com o evento que
      // o opt-out promete não gerar. Sem captação, sem par — nem lead, nem
      // descarte.
      if (leadCaptureEnabled && !resolvedLeadId) {
        const reason =
          upserted?.outcome === "discarded"
            ? upserted.reason
            : resolveLeadDiscardReason(extracted, { hasMatchingLead: Boolean(match) })
        const discardOrigin = { ...origin, reason: reason ?? "sem_contato" }
        metricEvents.push({
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType: "lead_discarded",
          eventKey: buildPublicFormLeadDiscardedEventKey(job.requestKey, attributionEmailLogId),
          origin: json(discardOrigin),
          radarOrigin: discardOrigin,
        })
      }

      if (scheduled) {
        metricEvents.push({
          formId: job.snapshot.formId,
          publicationId: job.publicationId,
          visitorSessionId,
          eventType: "meeting_scheduled",
          eventKey: buildPublicFormMetricEventKey(
            visitorSessionId,
            "meeting_scheduled",
            attributionEmailLogId
          ),
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
              emailLogId: typeof origin.emailLogId === "string" ? origin.emailLogId : null,
              campaignId: typeof origin.campaignId === "string" ? origin.campaignId : null,
            })
          : undefined,
        metricEvents,
      })

      for (const event of metricEvents) {
        const published = await publishServerPublicFormMetricEvent(
          buildPublicFormMetricQueuePayload(form.publicId, {
            visitorSessionId: event.visitorSessionId,
            eventType: event.eventType,
            eventKey: event.eventKey,
            origin: event.radarOrigin ?? origin,
          }),
          "PublicFormSubmissionUseCase",
        )
        if (!published) {
          throw new Error(`Falha ao publicar evento ${event.eventType} da submissão`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar respostas"
      console.error("[PublicFormSubmissionUseCase][processInBackground]", message)
      await publicFormsRepository.markSubmissionFailed(job.submissionId, message)
      throw error
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

  /**
   * PR2.3: chamado pelo `after()` da rota de submissão. Só publica na fila
   * `public-form-submission-events` (sem lead match/agendamento no isolate
   * HTTP) — o outbox só recebe linha se as 3 tentativas de publish esgotarem.
   * Delegado a um módulo próprio (ver comentário lá) para ficar testável
   * sem a cadeia pesada de dependências deste UseCase, e para manter a
   * governança de acesso a dados só via UseCase/Service na route.
   */
  async queueForBackgroundProcessing(job: PublicFormSubmissionBackgroundJob): Promise<void> {
    await queueSubmissionForBackgroundProcessing(job)
  }
}

export const publicFormSubmissionUseCase = new PublicFormSubmissionUseCase()
