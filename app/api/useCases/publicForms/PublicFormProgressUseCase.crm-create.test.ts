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
const publishServerPublicFormMetricEvent = mock(async () => true)
const recordMetric = mock(async () => true)
const gateExecute = mock(async () => ({ isValid: true, result: { skipped: "gate_open" as const } }))

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic, recordMetric },
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
  isBlankPublicFormAnswerValue: (value: unknown) =>
    value === undefined || value === null || (typeof value === "string" && value.trim() === ""),
  publicFormAnswerValueText: (value: unknown) => (typeof value === "string" && value.trim() ? value : null),
  findMatchingLead: mock(async () => null),
  upsertLeadFromFormAnswers,
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: (
    publicId: string,
    input: Record<string, unknown>,
  ) => ({ publicId, ...input }),
  publishServerPublicFormMetricEvent,
}))
mock.module("@/app/api/useCases/radar/CreateCrmLeadFromRadarFormGateUseCase", () => ({
  createCrmLeadFromRadarFormGateUseCase: { execute: gateExecute },
}))

const { PublicFormProgressUseCase } = await import("./PublicFormProgressUseCase")

describe("PublicFormProgressUseCase form agnóstico (Radar-gate)", () => {
  const useCase = new PublicFormProgressUseCase()

  beforeEach(() => {
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationById.mockClear()
    listSubmissionAnswers.mockClear()
    upsertLeadFromFormAnswers.mockClear()
    upsertProgressSubmission.mockClear()
    upsertMetricEvent.mockClear()
    publishServerPublicFormMetricEvent.mockClear()
    recordMetric.mockClear()
    gateExecute.mockClear()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    listSubmissionAnswers.mockResolvedValue([])
    upsertLeadFromFormAnswers.mockResolvedValue(null)
    upsertProgressSubmission.mockResolvedValue({ id: "sub-progress" })
    publishServerPublicFormMetricEvent.mockResolvedValue(true)
    recordMetric.mockResolvedValue(true)
    gateExecute.mockResolvedValue({ isValid: true, result: { skipped: "gate_open" as const } })
  })

  it("não cria lead CRM — só encaminha question_answered com answerValue", async () => {
    const output = await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-campaign",
      answers: [
        { questionId: NAME_ID, value: "Maria Silva" },
        { questionId: PHONE_ID, value: "(11) 98888-7777" },
      ],
      origin: { emailLogId: CAMPAIGN_EMAIL_LOG_ID },
    })

    expect(output.isValid).toBe(true)
    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
    expect(recordMetric).not.toHaveBeenCalled()
    expect(gateExecute).toHaveBeenCalledTimes(1)
    expect(gateExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: FORM_ID,
        visitorSessionId: "session-campaign",
        publicationId: PUBLICATION_ID,
      }),
    )
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledTimes(2)
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `session-campaign:question_answered:${NAME_ID}`,
        answerValue: "Maria Silva",
        answerMappingKey: "name",
        createCrmLead: false,
      }),
      "PublicFormProgressUseCase",
    )
  })

  it("não republica question_answered vazio (first-write não consome a chave)", async () => {
    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-empty",
      answers: [{ questionId: NAME_ID, value: "  " }],
    })

    expect(upsertMetricEvent).not.toHaveBeenCalled()
    expect(publishServerPublicFormMetricEvent).not.toHaveBeenCalled()
    expect(gateExecute).not.toHaveBeenCalled()
  })

  it("publica o blur de uma pergunta com a chave unificada mesmo com respostas acumuladas", async () => {
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

    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledTimes(1)
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `session-blur:question_answered:${PHONE_ID}`,
        answerValue: "(11) 98888-7777",
        answerMappingKey: "phone",
      }),
      "PublicFormProgressUseCase",
    )
    expect(recordMetric).not.toHaveBeenCalled()
    expect(gateExecute).toHaveBeenCalledTimes(1)
  })

  it("fila indisponível: encaminha question_answered inline ao Radar sem criar CRM no Progress", async () => {
    publishServerPublicFormMetricEvent.mockResolvedValue(false)

    const output = await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-queue-down",
      answers: [
        { questionId: NAME_ID, value: "Maria Silva" },
        { questionId: PHONE_ID, value: "(11) 98888-7777" },
      ],
    })

    expect(output.isValid).toBe(true)
    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
    expect(recordMetric).toHaveBeenCalledTimes(2)
    expect(recordMetric).toHaveBeenCalledWith(
      PUBLIC_ID,
      expect.objectContaining({
        eventType: "question_answered",
        eventKey: `session-queue-down:question_answered:${PHONE_ID}`,
        answerValue: "(11) 98888-7777",
        answerMappingKey: "phone",
        createCrmLead: false,
      }),
      { radarMode: "inline" },
    )
    expect(gateExecute).toHaveBeenCalledTimes(1)
  })

  it("reavalia A+C na correção mesmo com o mesmo eventKey (fila first-write)", async () => {
    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-revision",
      answers: [{ questionId: PHONE_ID, value: "119" }],
    })
    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-revision",
      answers: [{ questionId: PHONE_ID, value: "(11) 98888-7777" }],
    })

    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
    expect(gateExecute).toHaveBeenCalledTimes(2)
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledTimes(2)
    expect(publishServerPublicFormMetricEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `session-revision:question_answered:${PHONE_ID}`,
        createCrmLead: false,
      }),
      "PublicFormProgressUseCase",
    )
  })
})
