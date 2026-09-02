import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — o claim atômico de `upsertLeadFromFormAnswers` só fecha a corrida
 * do `/progress` (nota `2026-08-28-liber-leads-duplicados...`, adenda 02/09)
 * se `submissionId` chegar até o criador legado. Este teste tranca o fio: a
 * submissão já resolvida da sessão (`resolved.sessionSubmission.id`) precisa
 * ser passada para `legacyLeadCreator.createOrUpdate`, senão o claim nunca
 * dispara para o caminho que efetivamente causa o bug em produção.
 */

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

const getPublic = mock(async () => ({ publicationId: PUBLICATION_ID, snapshot }))
const findLatestSessionSubmissionOnForm = mock(
  async () =>
    null as {
      id: string
      publicationId: string
      status: string
      leadId: string | null
    } | null,
)
const findPublicationById = mock(
  async () => null as { publicationId: string; snapshot: PublicFormSnapshot } | null,
)
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
const publishServerPublicFormMetricEvent = mock(async () => true)
const legacyCreateOrUpdate = mock(async () => ({ outcome: "skipped" }) as const)

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic, recordMetric: mock(async () => true) },
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
  publicFormAnswerValueText: (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null,
  findMatchingLead: mock(async () => null),
  upsertLeadFromFormAnswers: mock(async () => ({ outcome: "skipped" })),
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: (publicId: string, input: Record<string, unknown>) => ({
    publicId,
    ...input,
  }),
  publishServerPublicFormMetricEvent,
}))

const { PublicFormProgressUseCase } = await import("./PublicFormProgressUseCase")

describe("PublicFormProgressUseCase — threading do submissionId para o claim atômico", () => {
  // Modo "legacy" (não-radar): é o caminho legado que dispara o create direto,
  // o mesmo que causa a corrida em produção.
  const useCase = new PublicFormProgressUseCase(
    { createOrUpdate: legacyCreateOrUpdate },
    () => "legacy",
  )

  beforeEach(() => {
    findLatestSessionSubmissionOnForm.mockClear()
    findPublicationById.mockClear()
    listSubmissionAnswers.mockClear()
    upsertProgressSubmission.mockClear()
    upsertMetricEvent.mockClear()
    publishServerPublicFormMetricEvent.mockClear()
    legacyCreateOrUpdate.mockClear()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    findPublicationById.mockResolvedValue(null)
    listSubmissionAnswers.mockResolvedValue([])
    upsertProgressSubmission.mockResolvedValue({ id: "sub-progress" })
    publishServerPublicFormMetricEvent.mockResolvedValue(true)
    legacyCreateOrUpdate.mockResolvedValue({ outcome: "skipped" })
  })

  it("sessão já com submissão resolvida: passa o submissionId para o criador legado", async () => {
    findLatestSessionSubmissionOnForm.mockResolvedValueOnce({
      id: "sub-existente",
      publicationId: PUBLICATION_ID,
      status: "processing",
      leadId: null,
    })
    findPublicationById.mockResolvedValueOnce({ publicationId: PUBLICATION_ID, snapshot })

    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-1",
      answers: [{ questionId: PHONE_ID, value: "(11) 96432-6587" }],
    })

    expect(legacyCreateOrUpdate).toHaveBeenCalledTimes(1)
    const [arg] = legacyCreateOrUpdate.mock.calls[0] as unknown as [{ submissionId?: string }]
    expect(arg.submissionId).toBe("sub-existente")
  })

  it("primeira requisição da sessão (sem submissão ainda): submissionId vem undefined — comportamento de sempre", async () => {
    // `findLatestSessionSubmissionOnForm` continua null (default do beforeEach):
    // é a primeiríssima chamada de `/progress` da sessão, a linha ainda não existe.
    await useCase.execute(PUBLIC_ID, {
      visitorSessionId: "session-nova",
      answers: [
        { questionId: NAME_ID, value: "Maria Silva" },
        { questionId: PHONE_ID, value: "(11) 96432-6587" },
      ],
    })

    expect(legacyCreateOrUpdate).toHaveBeenCalledTimes(1)
    const [arg] = legacyCreateOrUpdate.mock.calls[0] as unknown as [{ submissionId?: string }]
    expect(arg.submissionId).toBeUndefined()
  })
})
