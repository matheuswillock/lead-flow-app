import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const CURRENT_PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PREVIOUS_PUBLICATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const Q_OLD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

function makeSnapshot(publicationQuestions: Array<{ id: string }>, version = 1): PublicFormSnapshot {
  return {
    formId: FORM_ID,
    publicId: PUBLIC_ID,
    version,
    publishedAt: "2026-01-01T00:00:00.000Z",
    name: "Form",
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Obrigado",
    successActions: [],
    thankYouPages: [],
    defaultThankYouPageId: "",
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    theme: {
      backgroundColor: "#fff",
      textColor: "#000",
      lineColor: "#ccc",
      accentColor: "#f00",
      buttonTextColor: "#fff",
      inputBackgroundColor: "#fff",
    },
    questions: publicationQuestions.map((question, position) => ({
      id: question.id,
        type: "text" as const,
      title: "Nome",
      required: false,
      scoreWeight: 0,
      options: [],
      position,
    })),
    rules: [],
    scoreBands: [],
  }
}

const getPublic = mock(async () => ({
  publicationId: CURRENT_PUBLICATION_ID,
  snapshot: makeSnapshot([{ id: "q-new" }], 2),
}))
const findSubmissionByRequestKey = mock(async () => null as {
  id: string
  formId: string
  publicationId: string
  status: string
  visitorSessionId?: string | null
} | null)
const findPublicationById = mock(async () => null as {
  publicationId: string
  snapshot: PublicFormSnapshot
} | null)
const findLatestSessionSubmissionOnForm = mock(async () => null)
const findPublicationContainingQuestions = mock(async () => null as {
  publicationId: string
  snapshot: PublicFormSnapshot
} | null)
const findCompletedSubmissionBySession = mock(async () => null)
const claimSubmissionForRetry = mock(async () => false)
const persistSubmissionAnswers = mock(async () => {})
const findProgressSubmission = mock(async () => null)
const createSubmission = mock(async () => ({ id: "sub-new" }))
const findFormSubmissionContext = mock(async () => ({
  id: FORM_ID,
  name: "Form",
  publicId: PUBLIC_ID,
  teamId: "team-1",
  assignedSdrId: null,
  emailCampaignTrackingEnabled: false,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
}))

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic },
}))

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findSubmissionByRequestKey,
    findPublicationById,
    findLatestSessionSubmissionOnForm,
    findPublicationContainingQuestions,
    findCompletedSubmissionBySession,
    claimSubmissionForRetry,
    persistSubmissionAnswers,
    findProgressSubmission,
    createSubmission,
    findFormSubmissionContext,
    finalizeProgressSubmission: mock(async () => ({ id: "sub-progress" })),
  },
}))

mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => false,
  canUpdateLeadFromExtracted: () => false,
  extractLeadDataFromSnapshot: () => ({}),
  findMatchingLead: mock(async () => null),
  upsertLeadFromFormAnswers: mock(async () => null),
}))
mock.module("@/app/api/services/leadSchedule/LeadScheduleService", () => ({
  leadScheduleService: {},
}))
mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
  publicLeadFormUseCase: {},
}))
mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: { execute: mock(async () => ({ isValid: true, result: null })) },
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock(() => ({})),
  publishServerPublicFormMetricEvent: mock(async () => {}),
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

describe("PublicFormSubmissionUseCase.accept publicação da sessão", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    getPublic.mockClear()
    findSubmissionByRequestKey.mockClear()
    findPublicationById.mockClear()
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationContainingQuestions.mockClear()
    findCompletedSubmissionBySession.mockClear()
    persistSubmissionAnswers.mockClear()
    createSubmission.mockClear()
    findProgressSubmission.mockClear()
    findSubmissionByRequestKey.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationContainingQuestions.mockResolvedValue(null)
    findCompletedSubmissionBySession.mockResolvedValue(null)
    findProgressSubmission.mockResolvedValue(null)
    createSubmission.mockResolvedValue({ id: "sub-new" })
  })

  it("não rejeita requestKey de outra publicação do mesmo form — continua nela", async () => {
    const previousSnapshot = makeSnapshot([{ id: Q_OLD }], 1)
    findSubmissionByRequestKey.mockResolvedValueOnce({
      id: "sub-existing",
      formId: FORM_ID,
      publicationId: PREVIOUS_PUBLICATION_ID,
      status: "failed",
      visitorSessionId: "session-1",
    })
    findPublicationById.mockResolvedValueOnce({
      publicationId: PREVIOUS_PUBLICATION_ID,
      snapshot: previousSnapshot,
    })
    claimSubmissionForRetry.mockResolvedValueOnce(true)

    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-1",
      answers: [{ questionId: Q_OLD, value: "Ana" }],
      origin: {},
      visitorSessionId: "session-1",
    })

    expect(output.isValid).toBe(true)
    expect(claimSubmissionForRetry).toHaveBeenCalledWith(
      "sub-existing",
      PREVIOUS_PUBLICATION_ID,
      expect.any(Date),
    )
    const result = output.result as { background?: { publicationId: string } }
    expect(result.background?.publicationId).toBe(PREVIOUS_PUBLICATION_ID)
  })

  it("grava na publicação que cobre as respostas quando a vigente mudou", async () => {
    const previousSnapshot = makeSnapshot([{ id: Q_OLD }], 1)
    findPublicationContainingQuestions.mockResolvedValueOnce({
      publicationId: PREVIOUS_PUBLICATION_ID,
      snapshot: previousSnapshot,
    })

    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-2",
      answers: [{ questionId: Q_OLD, value: "Ana" }],
      origin: {},
    })

    expect(output.isValid).toBe(true)
    expect(createSubmission).toHaveBeenCalledTimes(1)
    const createArg = createSubmission.mock.calls[0] as unknown as [{ publicationId: string }]
    expect(createArg[0].publicationId).toBe(PREVIOUS_PUBLICATION_ID)
  })
})
