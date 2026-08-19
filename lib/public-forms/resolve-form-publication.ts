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

export async function resolvePublicFormPublicationForVisitor(input: {
  current: { publicationId: string; snapshot: PublicFormSnapshot }
  visitorSessionId?: string | null
  questionIds: string[]
}): Promise<ResolvedPublicFormPublication> {
  const formId = input.current.snapshot.formId

  if (input.visitorSessionId) {
    const sessionSubmission = await publicFormsRepository.findLatestSessionSubmissionOnForm(
      formId,
      input.visitorSessionId,
    )
    if (sessionSubmission) {
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
