import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

const findLatestSessionSubmissionOnForm = mock(async () => null as {
  publicationId: string
  status: string
  leadId: string | null
} | null)
const findPublicationById = mock(async () => null as {
  publicationId: string
  snapshot: unknown
} | null)
const findPublicationContainingQuestions = mock(async () => null as {
  publicationId: string
  snapshot: unknown
} | null)

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findLatestSessionSubmissionOnForm,
    findPublicationById,
    findPublicationContainingQuestions,
  },
}))

const { resolvePublicFormPublicationForVisitor } = await import("./resolve-form-publication")

const CURRENT_SNAPSHOT = {
  formId: "form-1",
  questions: [{ id: "q-new" }],
} as unknown as PublicFormSnapshot

const PREVIOUS_SNAPSHOT = {
  formId: "form-1",
  questions: [{ id: "q-old" }],
}

describe("resolvePublicFormPublicationForVisitor", () => {
  beforeEach(() => {
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationById.mockClear()
    findPublicationContainingQuestions.mockClear()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    findPublicationContainingQuestions.mockResolvedValue(null)
  })

  it("mantém a publicação da sessão quando já existe progress/submissão", async () => {
    findLatestSessionSubmissionOnForm.mockResolvedValueOnce({
      publicationId: "pub-old",
      status: "processing",
      leadId: null,
    })
    findPublicationById.mockResolvedValueOnce({
      publicationId: "pub-old",
      snapshot: PREVIOUS_SNAPSHOT,
    })

    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      visitorSessionId: "session-1",
      questionIds: ["q-old"],
    })

    expect(resolved.publicationId).toBe("pub-old")
    expect(resolved.snapshot).toEqual(PREVIOUS_SNAPSHOT as never)
    expect(findPublicationContainingQuestions).not.toHaveBeenCalled()
  })

  it("usa a publicação que cobre as respostas quando não há sessão", async () => {
    findPublicationContainingQuestions.mockResolvedValueOnce({
      publicationId: "pub-old",
      snapshot: PREVIOUS_SNAPSHOT,
    })

    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      visitorSessionId: "session-1",
      questionIds: ["q-old"],
    })

    expect(resolved.publicationId).toBe("pub-old")
    expect(findPublicationContainingQuestions).toHaveBeenCalledWith("form-1", ["q-old"])
  })

  it("cai no vigente quando nenhuma versão cobre as respostas", async () => {
    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      questionIds: ["q-missing"],
    })

    expect(resolved.publicationId).toBe("pub-current")
    expect(resolved.snapshot).toBe(CURRENT_SNAPSHOT)
  })
})
