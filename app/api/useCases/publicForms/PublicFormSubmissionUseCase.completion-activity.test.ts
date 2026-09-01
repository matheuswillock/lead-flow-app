import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * Bug 31/08 (Liber). A atividade de conclusão gravava só o note genérico
 * "Fim do preenchimento do formulário": com a resposta anexada no card errado,
 * nada na timeline dizia quem respondeu nem o que respondeu, e o cliente
 * concluía que a submissão "não chegou".
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
const Q_NAME = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
const Q_PHONE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"
const Q_PLAN = "dddddddd-dddd-4ddd-8ddd-ddddddddddd3"

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
        id: Q_NAME,
        type: "text",
        title: "Qual é o seu nome?",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 0,
        mappingTarget: "native_field",
        mappingKey: "name",
      },
      {
        id: Q_PHONE,
        type: "phone",
        title: "Telefone",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 1,
        mappingTarget: "native_field",
        mappingKey: "phone",
      },
      {
        id: Q_PLAN,
        type: "text",
        title: "Plano atual",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 2,
      },
    ],
    rules: [],
    scoreBands: [],
  } as unknown as PublicFormSnapshot
}

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
const completeSubmission = mock(async (input: { metricEvents: unknown[] }) => input.metricEvents)

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic: mock(async () => null) },
}))
mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findFormSubmissionContext,
    findLeadForSubmission: mock(async () => null),
    findSubmissionAcceptedAt: mock(async () => ({
      createdAt: new Date("2026-08-31T17:00:00.000Z"),
      dispatchAcceptedAt: null as Date | null,
    })),
    completeSubmission,
    markSubmissionFailed: mock(async () => {}),
  },
}))
mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => true,
  canUpdateLeadFromExtracted: () => true,
  extractLeadDataFromSnapshot: () => ({
    name: "Alexandre",
    email: "alexandre@libercorretora.com.br",
    phone: "(13) 99788-9618",
    normalizedPhone: "13997889618",
    native: {},
    custom: {},
    notes: [],
  }),
  findMatchingLead: mock(async () => undefined),
  upsertLeadFromFormAnswers: mock(
    async () => ({ outcome: "created", lead: { id: "lead-1", name: "Alexandre" } }) as unknown,
  ),
}))
mock.module("@/app/api/services/leadSchedule/LeadScheduleService", () => ({
  leadScheduleService: {},
}))
mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
  publicLeadFormUseCase: {},
}))
mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: {
    execute: mock(async () => ({ isValid: true, result: null })),
  },
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock((_publicId: string, input: unknown) => input),
  publishServerPublicFormMetricEvent: mock(async () => true),
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

const JOB = {
  submissionId: "sub-1",
  publicationId: PUBLICATION_ID,
  snapshot: makeSnapshot(),
  visibleAnswers: [
    { questionId: Q_NAME, value: "Alexandre" },
    { questionId: Q_PHONE, value: "(13) 99788-9618" },
    { questionId: Q_PLAN, value: "GNDI baixo custo" },
  ],
  visibleIds: [Q_NAME, Q_PHONE, Q_PLAN],
  score: 0,
  scoreBandLabel: null,
  origin: {},
  requestKey: "progress:sessao-alexandre:pub-1",
  visitorSessionId: "sessao-alexandre",
}

function activityBody(): string {
  const [call] = completeSubmission.mock.calls as unknown as [[{ activityBody?: string }]]
  return call[0].activityBody ?? ""
}

describe("PublicFormSubmissionUseCase — atividade de conclusão", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    completeSubmission.mockClear()
  })

  it("grava a identidade digitada e os pares pergunta → resposta", async () => {
    await useCase.processInBackground(JOB)

    const body = activityBody()
    expect(body).toContain("Nova resposta de formulário")
    expect(body).toContain("Alexandre")
    expect(body).toContain("(13) 99788-9618")
    expect(body).toContain("alexandre@libercorretora.com.br")
    expect(body).toContain("Qual é o seu nome?: Alexandre")
    expect(body).toContain("Plano atual: GNDI baixo custo")
    expect(body).not.toBe("Fim do preenchimento do formulário")
  })
})
