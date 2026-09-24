import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

const findLatestSessionSubmissionOnForm = mock(async () => null as {
  publicationId: string
  status: string
  leadId: string | null
} | null)
const findLatestSessionSubmissionForPublication = mock(async () => null as {
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
    findLatestSessionSubmissionForPublication,
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
    findLatestSessionSubmissionForPublication.mockClear()
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

  it("usa a publicação atual quando as respostas pertencem à tela republicada", async () => {
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
      questionIds: ["q-new"],
    })

    expect(resolved.publicationId).toBe("pub-current")
    expect(resolved.snapshot).toBe(CURRENT_SNAPSHOT)
    expect(resolved.sessionSubmission).toBeNull()
  })

  it("fixa a publicação que a tela informou mesmo quando os IDs também existem na atual", async () => {
    const renderedSubmission = {
      publicationId: "pub-old",
      status: "processing",
      leadId: null,
    }
    findPublicationById.mockResolvedValueOnce({
      publicationId: "pub-old",
      snapshot: { ...CURRENT_SNAPSHOT, questions: [{ id: "q-new" }] },
    })
    findLatestSessionSubmissionForPublication.mockResolvedValueOnce(renderedSubmission as never)

    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      renderedPublicationId: "pub-old",
      visitorSessionId: "session-1",
      questionIds: ["q-new"],
    })

    expect(resolved.publicationId).toBe("pub-old")
    expect(resolved.sessionSubmission).toBe(renderedSubmission as never)
    expect(findLatestSessionSubmissionOnForm).not.toHaveBeenCalled()
  })

  it("preserva a sessão quando ela já pertence à publicação atual", async () => {
    const currentSessionSubmission = {
      publicationId: "pub-current",
      status: "processing",
      leadId: null,
    }
    findLatestSessionSubmissionOnForm.mockResolvedValueOnce(currentSessionSubmission)

    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      visitorSessionId: "session-1",
      questionIds: ["q-new"],
    })

    expect(resolved.publicationId).toBe("pub-current")
    expect(resolved.snapshot).toBe(CURRENT_SNAPSHOT)
    expect(resolved.sessionSubmission?.publicationId).toBe("pub-current")
    expect(findPublicationById).not.toHaveBeenCalled()
  })

  it("preserva a publicação da sessão quando não há perguntas no payload", async () => {
    const previousSessionSubmission = {
      publicationId: "pub-old",
      status: "processing",
      leadId: null,
    }
    findLatestSessionSubmissionOnForm.mockResolvedValueOnce(previousSessionSubmission)
    findPublicationById.mockResolvedValueOnce({
      publicationId: "pub-old",
      snapshot: PREVIOUS_SNAPSHOT,
    })

    const resolved = await resolvePublicFormPublicationForVisitor({
      current: { publicationId: "pub-current", snapshot: CURRENT_SNAPSHOT },
      visitorSessionId: "session-1",
      questionIds: [],
    })

    expect(resolved.publicationId).toBe("pub-old")
    expect(resolved.sessionSubmission?.publicationId).toBe("pub-old")
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
