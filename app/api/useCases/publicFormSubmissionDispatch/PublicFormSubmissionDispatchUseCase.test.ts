import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  IPublicFormsRepository,
  PendingPublicFormSubmissionDispatch,
} from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { PublicFormSubmissionDispatchUseCase } from "./PublicFormSubmissionDispatchUseCase"

const claimPendingSubmissionDispatches = mock(async (): Promise<
  PendingPublicFormSubmissionDispatch[]
> => [])
const markSubmissionDispatchAccepted = mock(async () => {})
const markSubmissionDispatchDeferred = mock(async () => {})
const queueSubmission = mock(async () => ({ accepted: true }))

const repository = {
  claimPendingSubmissionDispatches,
  markSubmissionDispatchAccepted,
  markSubmissionDispatchDeferred,
} as unknown as IPublicFormsRepository

const pendingSubmission: PendingPublicFormSubmissionDispatch = {
  id: "submission-1",
  publicationId: "publication-1",
  eventId: "0ef8dd3a-8a61-4bd4-9ef3-682d3c144254",
  requestKey: "request-1",
  visitorSessionId: "visitor-1",
  score: 75,
  scoreBandLabel: "Quente",
  origin: { campaignId: "campaign-1" },
  snapshot: {
    formId: "form-1",
    questions: [{ id: "question-1" }],
  },
  answers: [
    {
      questionId: "question-1",
      value: "Ana",
      questionSnapshot: { id: "question-1" },
    },
  ],
}

describe("PublicFormSubmissionDispatchUseCase", () => {
  beforeEach(() => {
    claimPendingSubmissionDispatches.mockReset()
    markSubmissionDispatchAccepted.mockReset()
    markSubmissionDispatchDeferred.mockReset()
    queueSubmission.mockReset()
    queueSubmission.mockResolvedValue({ accepted: true })
  })

  it("reidrata e publica submissões sem aceite durável", async () => {
    claimPendingSubmissionDispatches.mockResolvedValue([pendingSubmission])
    const useCase = new PublicFormSubmissionDispatchUseCase(repository, queueSubmission)

    const output = await useCase.execute(10)

    expect(output.isValid).toBe(true)
    expect(claimPendingSubmissionDispatches).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, leaseUntil: expect.any(Date) }),
    )
    expect(queueSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "submission-1",
        eventId: "0ef8dd3a-8a61-4bd4-9ef3-682d3c144254",
        visibleAnswers: [{ questionId: "question-1", value: "Ana" }],
      }),
      expect.objectContaining({
        markAccepted: expect.any(Function),
        markDeferred: expect.any(Function),
      }),
    )
    expect(output.result).toEqual({ claimed: 1, accepted: 1, deferred: 0 })
  })

  it("adia a submissão quando o snapshot persistido não pode ser reidratado", async () => {
    claimPendingSubmissionDispatches.mockResolvedValue([
      { ...pendingSubmission, snapshot: { formId: "form-1" } },
    ])
    const useCase = new PublicFormSubmissionDispatchUseCase(repository, queueSubmission)

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(queueSubmission).not.toHaveBeenCalled()
    expect(markSubmissionDispatchDeferred).toHaveBeenCalledWith(
      "submission-1",
      "Snapshot de publicação inválido para reenvio de submissão",
    )
    expect(output.result).toEqual({ claimed: 1, accepted: 0, deferred: 1 })
  })
})
