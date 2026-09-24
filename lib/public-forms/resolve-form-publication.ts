import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { parsePublicFormSnapshot } from "@/lib/public-forms/publication-snapshot"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export type ResolvedPublicFormPublication = {
  publicationId: string
  snapshot: PublicFormSnapshot
  sessionSubmission: Awaited<
    ReturnType<typeof publicFormsRepository.findLatestSessionSubmissionOnForm>
  >
}

function snapshotContainsAllQuestions(
  snapshot: PublicFormSnapshot,
  questionIds: string[],
): boolean {
  if (questionIds.length === 0) return false

  const snapshotQuestionIds = new Set(snapshot.questions.map((question) => question.id))
  return questionIds.every((questionId) => snapshotQuestionIds.has(questionId))
}

export async function resolvePublicFormPublicationForVisitor(input: {
  current: { publicationId: string; snapshot: PublicFormSnapshot }
  visitorSessionId?: string | null
  renderedPublicationId?: string | null
  questionIds: string[]
}): Promise<ResolvedPublicFormPublication> {
  const formId = input.current.snapshot.formId

  if (input.renderedPublicationId) {
    const rendered =
      input.renderedPublicationId === input.current.publicationId
        ? { publicationId: input.current.publicationId, snapshot: input.current.snapshot }
        : await publicFormsRepository.findPublicationById(input.renderedPublicationId).then(
            (publication) => {
              const snapshot = publication ? parsePublicFormSnapshot(publication.snapshot) : null
              return publication && snapshot
                ? { publicationId: publication.publicationId, snapshot }
                : null
            },
          )

    if (rendered && rendered.snapshot.formId === formId) {
      const sessionSubmission = input.visitorSessionId
        ? await publicFormsRepository.findLatestSessionSubmissionForPublication(
            rendered.publicationId,
            input.visitorSessionId,
          )
        : null
      return { ...rendered, sessionSubmission }
    }
  }

  if (input.visitorSessionId) {
    const sessionSubmission = await publicFormsRepository.findLatestSessionSubmissionOnForm(
      formId,
      input.visitorSessionId,
    )
    if (sessionSubmission) {
      if (sessionSubmission.publicationId === input.current.publicationId) {
        return {
          publicationId: input.current.publicationId,
          snapshot: input.current.snapshot,
          sessionSubmission,
        }
      }

      if (snapshotContainsAllQuestions(input.current.snapshot, input.questionIds)) {
        return {
          publicationId: input.current.publicationId,
          snapshot: input.current.snapshot,
          sessionSubmission: null,
        }
      }

      const publication = await publicFormsRepository.findPublicationById(
        sessionSubmission.publicationId,
      )
      const snapshot = publication ? parsePublicFormSnapshot(publication.snapshot) : null
      if (publication && snapshot) {
        return {
          publicationId: publication.publicationId,
          snapshot,
          sessionSubmission,
        }
      }
    }
  }

  const covering = await publicFormsRepository.findPublicationContainingQuestions(
    formId,
    input.questionIds,
  )
  const coveringSnapshot = covering ? parsePublicFormSnapshot(covering.snapshot) : null
  if (covering && coveringSnapshot) {
    return {
      publicationId: covering.publicationId,
      snapshot: coveringSnapshot,
      sessionSubmission: null,
    }
  }

  return {
    publicationId: input.current.publicationId,
    snapshot: input.current.snapshot,
    sessionSubmission: null,
  }
}
