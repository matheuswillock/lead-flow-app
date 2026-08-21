import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import type {
  IPublicFormsRepository,
  PendingPublicFormSubmissionDispatch,
} from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { Output } from "@/lib/output"
import {
  parsePublicFormSnapshot,
  resolveStoredSubmissionAnswerQuestionId,
} from "@/lib/public-forms/publication-snapshot"
import { queueSubmissionForBackgroundProcessing } from "@/lib/public-forms/queue-submission-for-background-processing"
import type { PublicFormAnswerInput } from "@/lib/public-forms/types"
import type { IPublicFormSubmissionDispatchUseCase } from "./IPublicFormSubmissionDispatchUseCase"

const DEFAULT_BATCH_SIZE = 100
const DISPATCH_LEASE_MS = 2 * 60_000

type QueueSubmission = (
  job: PublicFormSubmissionBackgroundJob,
  dependencies: {
    markAccepted: (submissionId: string) => Promise<void>
    markDeferred: (submissionId: string, errorMessage: string) => Promise<void>
  },
) => Promise<{ accepted: boolean }>

function toOrigin(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toVisibleAnswers(
  submission: PendingPublicFormSubmissionDispatch,
): PublicFormAnswerInput[] {
  return submission.answers.flatMap((answer) => {
    const questionId = resolveStoredSubmissionAnswerQuestionId(
      answer.questionId,
      answer.questionSnapshot,
    )
    return questionId ? [{ questionId, value: answer.value }] : []
  })
}

function rehydrateSubmissionJob(
  submission: PendingPublicFormSubmissionDispatch,
): PublicFormSubmissionBackgroundJob | null {
  const snapshot = parsePublicFormSnapshot(submission.snapshot)
  if (!snapshot) return null

  const visibleAnswers = toVisibleAnswers(submission)
  const visibleIds = visibleAnswers.map((answer) => answer.questionId)

  return {
    submissionId: submission.id,
    publicationId: submission.publicationId,
    eventId: submission.eventId,
    snapshot,
    visibleAnswers,
    visibleIds,
    score: submission.score,
    scoreBandLabel: submission.scoreBandLabel,
    bandNote: submission.scoreBandLabel ? [`Qualificação: ${submission.scoreBandLabel}`] : undefined,
    origin: toOrigin(submission.origin),
    requestKey: submission.requestKey,
    visitorSessionId: submission.visitorSessionId,
  }
}

export class PublicFormSubmissionDispatchUseCase implements IPublicFormSubmissionDispatchUseCase {
  constructor(
    private readonly repository: IPublicFormsRepository = publicFormsRepository,
    private readonly queueSubmission: QueueSubmission = queueSubmissionForBackgroundProcessing,
  ) {}

  async execute(limit = DEFAULT_BATCH_SIZE): Promise<Output> {
    try {
      const submissions = await this.repository.claimPendingSubmissionDispatches({
        limit: Math.max(1, limit),
        leaseUntil: new Date(Date.now() + DISPATCH_LEASE_MS),
      })
      let accepted = 0
      let deferred = 0

      for (const submission of submissions) {
        const job = rehydrateSubmissionJob(submission)
        if (!job) {
          deferred += 1
          await this.repository.markSubmissionDispatchDeferred(
            submission.id,
            "Snapshot de publicação inválido para reenvio de submissão",
          )
          continue
        }

        const result = await this.queueSubmission(job, {
          markAccepted: (submissionId) => this.repository.markSubmissionDispatchAccepted(submissionId),
          markDeferred: (submissionId, errorMessage) =>
            this.repository.markSubmissionDispatchDeferred(submissionId, errorMessage),
        })
        if (result.accepted) accepted += 1
        else deferred += 1
      }

      console.info("[PublicFormSubmissionDispatchUseCase] Lote processado", {
        claimed: submissions.length,
        accepted,
        deferred,
      })
      return new Output(
        true,
        [`${accepted} submissão(ões) aceita(s), ${deferred} adiada(s) para retry`],
        [],
        { claimed: submissions.length, accepted, deferred },
      )
    } catch (error) {
      console.error("[PublicFormSubmissionDispatchUseCase][execute]", error)
      return new Output(
        false,
        [],
        ["Erro ao despachar submissões pendentes de formulários públicos"],
        null,
      )
    }
  }
}

export const publicFormSubmissionDispatchUseCase = new PublicFormSubmissionDispatchUseCase()
