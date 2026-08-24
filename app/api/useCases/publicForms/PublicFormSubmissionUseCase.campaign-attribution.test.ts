import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * Gate de sessão do `accept()` — `findCompletedSubmissionBySession`.
 *
 * O cookie `cs_form_vs` vive 30 dias, então o mesmo navegador pode converter
 * por mais de uma campanha dentro da mesma sessão. Antes deste teste o gate
 * comparava só `(publicationId, visitorSessionId)`: a segunda conversão recebia
 * "Respostas já recebidas", nenhuma submissão nova nascia e, por consequência,
 * NENHUMA métrica era gerada — o escopo por atribuição do `eventKey` nem chegava
 * a ser alcançado. A conversão da campanha nova sumia do funil.
 *
 * Este arquivo trava o comportamento nos dois sentidos: curto-circuito continua
 * valendo para a MESMA atribuição (idempotência real de reenvio), e some quando
 * a atribuição muda.
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
const QUESTION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const SESSION = "session-com-duas-campanhas"

const EMAIL_LOG_A = "e231d889-da04-4273-afb2-c2e82fa9a04e"
const EMAIL_LOG_B = "3fc5f0a2-1111-4222-8333-444455556666"

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
        id: QUESTION_ID,
        type: "text" as const,
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

type CompletedSubmission = {
  id: string
  formId: string
  publicationId: string
  status: string
  visitorSessionId: string | null
  origin: Record<string, unknown> | null
}

const getPublic = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: makeSnapshot(),
}))
const findSubmissionByRequestKey = mock(async () => null as CompletedSubmission | null)
const findCompletedSubmissionBySession = mock(async () => null as CompletedSubmission | null)
// O resolver só devolve `sessionSubmission` se ESTE lookup também resolver
// (resolve-form-publication.ts:26-36). Devolver `null` aqui fazia o gate 3 cair
// no fallback e nunca disparar — mock incompleto que dava falso verde.
const findPublicationById = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: makeSnapshot() as unknown,
}))
// Gate 3: `resolvePublicFormPublicationForVisitor` usa este repositório e tem
// early return próprio, ANTES do gate por publicação. Mockar sempre como `null`
// foi o buraco da primeira versão deste arquivo: o gate nunca disparava e o
// teste dava verde com o bug vivo.
const findLatestSessionSubmissionOnForm = mock(async () => null as CompletedSubmission | null)
const findPublicationContainingQuestions = mock(async () => null)
const claimSubmissionForRetry = mock(async () => false)
const persistSubmissionAnswers = mock(async () => {})
const findProgressSubmission = mock(async () => null)
const createSubmission = mock(async () => ({ id: "sub-nova" }))
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
    findLeadForSubmission: mock(async () => null),
    completeSubmission: mock(async () => {}),
    markSubmissionFailed: mock(async () => {}),
    finalizeProgressSubmission: mock(async () => ({ id: "sub-progress" })),
  },
}))

mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => false,
  canUpdateLeadFromExtracted: () => false,
  extractLeadDataFromSnapshot: () => ({
    name: "Ana",
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
  resolveEmailCampaignFormAttributionUseCase: {
    execute: mock(async () => ({ isValid: true, result: null })),
  },
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock(() => ({})),
  publishServerPublicFormMetricEvent: mock(async () => true),
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

function completedFrom(emailLogId: string | null): CompletedSubmission {
  return {
    id: "sub-anterior",
    formId: FORM_ID,
    publicationId: PUBLICATION_ID,
    status: "completed",
    visitorSessionId: SESSION,
    origin: emailLogId ? { emailLogId, campaignId: "campanha-anterior" } : { source: "direct" },
  }
}

function submit(emailLogId: string | null, requestKey: string) {
  return {
    requestKey,
    answers: [{ questionId: QUESTION_ID, value: "Ana" }],
    origin: emailLogId ? { emailLogId } : {},
    visitorSessionId: SESSION,
  }
}

describe("PublicFormSubmissionUseCase.accept — gate de sessão por atribuição", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    findSubmissionByRequestKey.mockReset()
    findSubmissionByRequestKey.mockResolvedValue(null)
    findCompletedSubmissionBySession.mockReset()
    findCompletedSubmissionBySession.mockResolvedValue(null)
    findLatestSessionSubmissionOnForm.mockReset()
    findLatestSessionSubmissionOnForm.mockResolvedValue(null)
    createSubmission.mockClear()
    createSubmission.mockResolvedValue({ id: "sub-nova" })
  })

  describe("gate 3 — sessão resolvida pela publicação (roda antes dos outros)", () => {
    it("campanha DIFERENTE não é bloqueada pelo early return do resolver", async () => {
      findLatestSessionSubmissionOnForm.mockResolvedValueOnce(completedFrom(EMAIL_LOG_A))

      const output = await useCase.accept(PUBLIC_ID, submit(EMAIL_LOG_B, "req:el:b"))

      expect(output.isValid).toBe(true)
      expect((output.result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(false)
      expect(createSubmission).toHaveBeenCalledTimes(1)
    })

    it("MESMA campanha continua bloqueada nesse gate", async () => {
      findLatestSessionSubmissionOnForm.mockResolvedValueOnce(completedFrom(EMAIL_LOG_A))

      const output = await useCase.accept(PUBLIC_ID, submit(EMAIL_LOG_A, "req:el:a"))

      const result = output.result as { alreadyProcessed?: boolean; submissionId?: string }
      expect(result.alreadyProcessed).toBe(true)
      expect(result.submissionId).toBe("sub-anterior")
      expect(createSubmission).not.toHaveBeenCalled()
    })
  })

  it("mesma sessão, campanha DIFERENTE → não bloqueia, cria submissão nova", async () => {
    findCompletedSubmissionBySession.mockResolvedValueOnce(completedFrom(EMAIL_LOG_A))

    const output = await useCase.accept(PUBLIC_ID, submit(EMAIL_LOG_B, "req:el:b"))

    expect(output.isValid).toBe(true)
    const result = output.result as { alreadyProcessed?: boolean }
    expect(result.alreadyProcessed).toBe(false)
    expect(createSubmission).toHaveBeenCalledTimes(1)
  })

  it("mesma sessão, MESMA campanha → bloqueia (idempotência de reenvio preservada)", async () => {
    findCompletedSubmissionBySession.mockResolvedValueOnce(completedFrom(EMAIL_LOG_A))

    const output = await useCase.accept(PUBLIC_ID, submit(EMAIL_LOG_A, "req:el:a"))

    expect(output.isValid).toBe(true)
    const result = output.result as { alreadyProcessed?: boolean; submissionId?: string }
    expect(result.alreadyProcessed).toBe(true)
    expect(result.submissionId).toBe("sub-anterior")
    expect(createSubmission).not.toHaveBeenCalled()
  })

  it("conversão anterior direta, agora vinda de campanha → não bloqueia", async () => {
    findCompletedSubmissionBySession.mockResolvedValueOnce(completedFrom(null))

    const output = await useCase.accept(PUBLIC_ID, submit(EMAIL_LOG_A, "req:el:a"))

    expect(output.isValid).toBe(true)
    expect((output.result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(false)
    expect(createSubmission).toHaveBeenCalledTimes(1)
  })

  it("direta → direta continua bloqueando (comportamento antigo intacto)", async () => {
    findCompletedSubmissionBySession.mockResolvedValueOnce(completedFrom(null))

    const output = await useCase.accept(PUBLIC_ID, submit(null, "req-direto"))

    expect((output.result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(true)
    expect(createSubmission).not.toHaveBeenCalled()
  })

  it("emailLogId forjado no origin é ignorado — trata como visita direta", async () => {
    findCompletedSubmissionBySession.mockResolvedValueOnce(completedFrom(null))

    const output = await useCase.accept(PUBLIC_ID, {
      ...submit(null, "req-forjado"),
      origin: { emailLogId: "../../etc/passwd" },
    })

    // Não-UUID não vira atribuição, então casa com a submissão direta anterior.
    expect((output.result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(true)
    expect(createSubmission).not.toHaveBeenCalled()
  })
})
