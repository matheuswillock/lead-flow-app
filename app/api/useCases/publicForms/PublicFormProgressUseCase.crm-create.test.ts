import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
} from "@/lib/public-forms/lead-identity"

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NAME_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PHONE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const CAMPAIGN_EMAIL_LOG_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function makeSnapshot(): PublicFormSnapshot {
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
        id: NAME_ID,
        type: "text",
        title: "Nome",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 0,
        mappingTarget: "native_field",
        mappingKey: "name",
      },
      {
        id: PHONE_ID,
        type: "phone",
        title: "Telefone",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 1,
        mappingTarget: "native_field",
        mappingKey: "phone",
      },
    ],
    rules: [],
    scoreBands: [],
  }
}

const snapshot = makeSnapshot()

const getPublic = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot,
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
  emailCampaignTrackingEnabled: true,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
}))
const listSubmissionAnswers = mock(async () => [] as Array<{ questionId: string; value: unknown }>)
const upsertProgressSubmission = mock(async () => ({ id: "sub-progress" }))
const upsertMetricEvent = mock(async () => {})
const upsertLeadFromFormAnswers = mock(async () => null as { lead: { id: string } } | null)

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
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
  findMatchingLead: mock(async () => null),
  upsertLeadFromFormAnswers,
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock(() => ({})),
  publishServerPublicFormMetricEvent: mock(async () => {}),
}))

const { PublicFormProgressUseCase } = await import("./PublicFormProgressUseCase")

describe("PublicFormProgressUseCase CRM A+C", () => {
  const useCase = new PublicFormProgressUseCase()

  beforeEach(() => {
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationById.mockClear()
    listSubmissionAnswers.mockClear()
    upsertLeadFromFormAnswers.mockClear()
    upsertProgressSubmission.mockClear()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    listSubmissionAnswers.mockResolvedValue([])
    upsertLeadFromFormAnswers.mockResolvedValue(null)
    upsertProgressSubmission.mockResolvedValue({ id: "sub-progress" })
  })

  it("cria lead no time do form com allowCreate mesmo em origem de campanha cs_el", async () => {
    const output = await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-campaign",
      answers: [
        { questionId: NAME_ID, value: "Maria Silva" },
        { questionId: PHONE_ID, value: "(11) 98888-7777" },
      ],
      origin: { emailLogId: CAMPAIGN_EMAIL_LOG_ID },
    })

    expect(output.isValid).toBe(true)
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledTimes(1)
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ allowCreate: true }),
    )
  })

  it("não cria de novo quando a sessão já tem leadId", async () => {
    findLatestSessionSubmissionOnForm.mockResolvedValue({
      id: "sub-session",
      publicationId: PUBLICATION_ID,
      status: "processing",
      leadId: "lead-existing",
    })
    findPublicationById.mockResolvedValue({
      publicationId: PUBLICATION_ID,
      snapshot,
    })

    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-existing",
      answers: [
        { questionId: NAME_ID, value: "Maria Silva" },
        { questionId: PHONE_ID, value: "(11) 98888-7777" },
      ],
      origin: { emailLogId: CAMPAIGN_EMAIL_LOG_ID },
    })

    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ allowCreate: false }),
    )
  })

  it("avalia A+C com respostas acumuladas da sessão no blur de uma pergunta", async () => {
    findLatestSessionSubmissionOnForm.mockResolvedValue({
      id: "sub-session",
      publicationId: PUBLICATION_ID,
      status: "processing",
      leadId: null,
    })
    findPublicationById.mockResolvedValue({
      publicationId: PUBLICATION_ID,
      snapshot,
    })
    listSubmissionAnswers.mockResolvedValue([{ questionId: NAME_ID, value: "Maria Silva" }])

    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-blur",
      answers: [{ questionId: PHONE_ID, value: "(11) 98888-7777" }],
    })

    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCreate: true,
        answers: [
          { questionId: NAME_ID, value: "Maria Silva" },
          { questionId: PHONE_ID, value: "(11) 98888-7777" },
        ],
      }),
    )
  })
})
