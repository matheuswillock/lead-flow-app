import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — E1. `required` é invariante do servidor.
 *
 * Divergência medida contra a auditoria (F1, 24/08): `accept()` **já** rodava
 * `validateAnswer` sobre as perguntas visíveis desde o commit original do motor
 * (`face07b9`) — o que faltava era o contrato de erro. As 102 submissões
 * `completed` sem resposta de telefone não passaram por aqui: são cascas do
 * `/progress` completadas pelo cron de re-despacho (E0/DA6), que reidrata a
 * submissão direto no `processInBackground` sem revalidar.
 *
 * O que este estágio acrescenta, então: código por pergunta no `Output` (para o
 * renderer poder marcar o campo, 41-E2), 422 em vez de 400 na rota, e a métrica
 * `form_validation_failed` com `origin.source='server'` para o funil separar a
 * recusa do servidor da validação de cliente.
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
const Q_TAGS = "dddddddd-dddd-4ddd-8ddd-ddddddddddd3"

type QuestionSeed = {
  id: string
  type: "text" | "phone" | "multiple_choice"
  required: boolean
  title: string
  options?: Array<{ label: string; value: string; score: number }>
}

function makeSnapshot(
  questions: QuestionSeed[],
  rules: PublicFormSnapshot["rules"] = [],
): PublicFormSnapshot {
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
    questions: questions.map((question, position) => ({
      id: question.id,
      type: question.type,
      title: question.title,
      required: question.required,
      scoreWeight: 0,
      options: question.options ?? [],
      position,
    })),
    rules,
    scoreBands: [],
  } as unknown as PublicFormSnapshot
}

const NAME_AND_PHONE = makeSnapshot([
  { id: Q_NAME, type: "text", required: true, title: "Qual o seu nome?" },
  { id: Q_PHONE, type: "phone", required: true, title: "Qual o seu WhatsApp?" },
])

const getPublic = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: NAME_AND_PHONE,
}))
const findSubmissionByRequestKey = mock(async () => null as { status: string } | null)
const findPublicationById = mock(async () => null)
const findLatestSessionSubmissionOnForm = mock(async () => null)
const findPublicationContainingQuestions = mock(async () => null)
const findCompletedSubmissionBySession = mock(async () => null)
const claimSubmissionForRetry = mock(async () => false)
const persistSubmissionAnswers = mock(async () => {})
const findProgressSubmission = mock(async () => null)
const createSubmission = mock(async () => ({ id: "sub-new" }))
const upsertMetricEvent = mock(async () => {})

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
    upsertMetricEvent,
    finalizeProgressSubmission: mock(async () => ({ id: "sub-progress" })),
  },
}))

mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => false,
  canUpdateLeadFromExtracted: () => false,
  extractLeadDataFromSnapshot: () => ({
    name: "",
    email: "",
    phone: "",
    normalizedPhone: "",
    native: {},
    custom: {},
    notes: [],
  }),
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
  resolveEmailCampaignFormAttributionUseCase: { execute: mock(async () => ({ isValid: true })) },
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock(() => ({})),
  publishServerPublicFormMetricEvent: mock(async () => true),
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

type ValidationIssue = { questionId: string; code: string }

function issuesOf(result: unknown): ValidationIssue[] {
  return (result as { validation?: ValidationIssue[] } | null)?.validation ?? []
}

describe("PublicFormSubmissionUseCase.accept validação de obrigatórias", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    getPublic.mockReset()
    getPublic.mockResolvedValue({ publicationId: PUBLICATION_ID, snapshot: NAME_AND_PHONE })
    findSubmissionByRequestKey.mockReset()
    findSubmissionByRequestKey.mockResolvedValue(null)
    findCompletedSubmissionBySession.mockReset()
    findCompletedSubmissionBySession.mockResolvedValue(null)
    findProgressSubmission.mockReset()
    findProgressSubmission.mockResolvedValue(null)
    findPublicationContainingQuestions.mockReset()
    findPublicationContainingQuestions.mockResolvedValue(null)
    findLatestSessionSubmissionOnForm.mockReset()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    createSubmission.mockReset()
    createSubmission.mockResolvedValue({ id: "sub-new" })
    persistSubmissionAnswers.mockReset()
    upsertMetricEvent.mockReset()
  })

  // T-F1.1
  it("recusa submissão sem a resposta da pergunta required visível, com código por pergunta", async () => {
    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-required-1",
      answers: [{ questionId: Q_NAME, value: "Maria Silva" }],
      origin: {},
    })

    expect(output.isValid).toBe(false)
    expect(issuesOf(output.result)).toEqual([{ questionId: Q_PHONE, code: "required" }])
    expect(createSubmission).not.toHaveBeenCalled()
  })

  // T-F1.2
  it("não bloqueia por pergunta required que a regra de visibilidade escondeu", async () => {
    const hidden = makeSnapshot(
      [
        { id: Q_NAME, type: "text", required: true, title: "Qual o seu nome?" },
        { id: Q_PHONE, type: "phone", required: true, title: "Qual o seu WhatsApp?" },
      ],
      [
        {
          sourceQuestionId: Q_NAME,
          targetQuestionId: Q_PHONE,
          operator: "equals",
          comparisonValue: "Maria Silva",
          action: "skip",
        },
      ] as unknown as PublicFormSnapshot["rules"],
    )
    getPublic.mockResolvedValue({ publicationId: PUBLICATION_ID, snapshot: hidden })

    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-required-2",
      answers: [{ questionId: Q_NAME, value: "Maria Silva" }],
      origin: {},
    })

    expect(issuesOf(output.result)).toEqual([])
    expect(output.isValid).toBe(true)
    expect(createSubmission).toHaveBeenCalledTimes(1)
  })

  // T-F1.3
  it("trata string vazia e lista vazia como resposta ausente", async () => {
    const withTags = makeSnapshot([
      { id: Q_NAME, type: "text", required: true, title: "Qual o seu nome?" },
      {
        id: Q_TAGS,
        type: "multiple_choice",
        required: true,
        title: "Quais planos?",
        options: [{ label: "A", value: "a", score: 0 }],
      },
    ])
    getPublic.mockResolvedValue({ publicationId: PUBLICATION_ID, snapshot: withTags })

    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-required-3",
      answers: [
        { questionId: Q_NAME, value: "   " },
        { questionId: Q_TAGS, value: [] },
      ],
      origin: {},
    })

    expect(output.isValid).toBe(false)
    expect(issuesOf(output.result)).toEqual([
      { questionId: Q_NAME, code: "name_too_short" },
      { questionId: Q_TAGS, code: "required" },
    ])
  })

  // Todo 3
  it("registra form_validation_failed com origin.source=server ao recusar", async () => {
    await useCase.accept(PUBLIC_ID, {
      requestKey: "req-required-4",
      answers: [{ questionId: Q_NAME, value: "Maria Silva" }],
      origin: {},
      visitorSessionId: "sessao-validacao-0001",
    })

    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    const [call] = upsertMetricEvent.mock.calls as unknown as [
      [{ eventType: string; visitorSessionId: string; origin: { source?: string } }],
    ]
    expect(call[0].eventType).toBe("form_validation_failed")
    expect(call[0].visitorSessionId).toBe("sessao-validacao-0001")
    expect(call[0].origin.source).toBe("server")
  })

  // SPEC E1, passo 4: idempotência do requestKey vem antes da validação.
  it("não revalida requestKey já completo — continua idempotente", async () => {
    findSubmissionByRequestKey.mockResolvedValue({
      id: "sub-done",
      formId: FORM_ID,
      status: "completed",
    } as never)

    const output = await useCase.accept(PUBLIC_ID, {
      requestKey: "req-required-5",
      answers: [],
      origin: {},
    })

    expect(output.isValid).toBe(true)
    expect(issuesOf(output.result)).toEqual([])
    expect(upsertMetricEvent).not.toHaveBeenCalled()
  })
})
