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

function makeSnapshot(questionId: string): PublicFormSnapshot {
  return {
    formId: FORM_ID,
    publicId: PUBLIC_ID,
    version: 1,
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
    questions: [
      {
        id: questionId,
        type: "text",
        title: "Nome",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 0,
      },
    ],
    rules: [],
    scoreBands: [],
  }
}

const getPublic = mock(async () => ({
  publicationId: CURRENT_PUBLICATION_ID,
  snapshot: makeSnapshot("q-new"),
}))
const findLatestSessionSubmissionOnForm = mock(async () => null as {
  id: string
  publicationId: string
  status: string
  leadId: string | null
} | null)
const findPublicationById = mock(async () => null as {
  publicationId: string
  snapshot: PublicFormSnapshot
} | null)
const findPublicationContainingQuestions = mock(async () => null)
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
const listSubmissionAnswers = mock(async () => [] as Array<{ questionId: string; value: unknown }>)
const upsertProgressSubmission = mock(async () => ({ id: "sub-progress" }))
const upsertMetricEvent = mock(async () => {})

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic },
}))
mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findLatestSessionSubmissionOnForm,
    findPublicationById,
    findPublicationContainingQuestions,
    findFormSubmissionContext,
    listSubmissionAnswers,
    upsertProgressSubmission,
    upsertMetricEvent,
  },
}))
mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => false,
  canUpdateLeadFromExtracted: () => false,
  extractLeadDataFromSnapshot: () => ({}),
  hasCrmGateAC: () => false,
  isBlankPublicFormAnswerValue: (value: unknown) =>
    value === undefined || value === null || (typeof value === "string" && value.trim() === ""),
  publicFormAnswerValueText: (value: unknown) => (typeof value === "string" && value.trim() ? value : null),
  findMatchingLead: mock(async () => null),
  upsertLeadFromFormAnswers: mock(async () => null),
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock(() => ({})),
  publishServerPublicFormMetricEvent: mock(async () => {}),
}))

const { PublicFormProgressUseCase } = await import("./PublicFormProgressUseCase")

describe("PublicFormProgressUseCase publicação da sessão", () => {
  const useCase = new PublicFormProgressUseCase(
    { createOrUpdate: mock(async () => null) },
    () => "radar",
  )

  beforeEach(() => {
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationById.mockClear()
    findPublicationContainingQuestions.mockClear()
    listSubmissionAnswers.mockClear()
    upsertProgressSubmission.mockClear()
    upsertMetricEvent.mockClear()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    findPublicationContainingQuestions.mockResolvedValue(null)
    listSubmissionAnswers.mockResolvedValue([])
  })

  it("continua na publicação da sessão e usa requestKey com esse publicationId", async () => {
    const previousSnapshot = makeSnapshot(Q_OLD)
    findLatestSessionSubmissionOnForm.mockResolvedValueOnce({
      id: "sub-session",
      publicationId: PREVIOUS_PUBLICATION_ID,
      status: "processing",
      leadId: null,
    })
    findPublicationById.mockResolvedValueOnce({
      publicationId: PREVIOUS_PUBLICATION_ID,
      snapshot: previousSnapshot,
    })

    const output = await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-1",
      answers: [{ questionId: Q_OLD, value: "Ana" }],
    })

    expect(output.isValid).toBe(true)
    expect(upsertProgressSubmission).toHaveBeenCalledTimes(1)
    const arg = upsertProgressSubmission.mock.calls[0] as unknown as [
      { publicationId: string; requestKey: string },
    ]
    expect(arg[0].publicationId).toBe(PREVIOUS_PUBLICATION_ID)
    expect(arg[0].requestKey).toBe(`progress:session-1:${PREVIOUS_PUBLICATION_ID}`)
    const metricArg = upsertMetricEvent.mock.calls[0] as unknown as [{ publicationId: string }]
    expect(metricArg[0].publicationId).toBe(PREVIOUS_PUBLICATION_ID)
  })
})
