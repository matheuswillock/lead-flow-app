import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — E2/DA2. Descarte de lead é evento de primeira classe.
 *
 * O par que o funil precisa: todo `form_completed` sai com `lead_created`,
 * `lead_attached` **ou** `lead_discarded`. Antes deste estágio o terceiro caso
 * era silêncio — 349 submissões completas sem lead e sem nenhuma linha que o
 * dissesse (auditoria F3).
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
        title: "Nome",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 0,
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
const findLeadForSubmission = mock(async () => null)
// Devolve o lote que recebeu — é o que a transação real faz quando nada é
// derrubado (review #1058). Um fake que devolvesse `undefined` esconderia que o
// caller agora enfileira o retorno, não o input.
const completeSubmission = mock(async (input: { metricEvents: unknown[] }) => input.metricEvents)
const markSubmissionFailed = mock(async () => {})
const findMatchingLead = mock(async () => undefined)
const upsertLeadFromFormAnswers = mock(
  async () => ({ outcome: "discarded", reason: "sem_telefone" }) as unknown,
)
const publishServerPublicFormMetricEvent = mock(async () => true)
const attributionExecute = mock(
  async () =>
    ({ isValid: true, result: null }) as {
      isValid: boolean
      result: { leadId: string; enrichedOrigin: Record<string, unknown> } | null
    },
)

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic: mock(async () => null) },
}))
mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findFormSubmissionContext,
    findLeadForSubmission,
    completeSubmission,
    markSubmissionFailed,
  },
}))
mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  canCreateLeadFromExtracted: () => false,
  canUpdateLeadFromExtracted: () => false,
  extractLeadDataFromSnapshot: () => ({
    name: "Maria Silva",
    email: "",
    phone: "",
    normalizedPhone: "",
    native: {},
    custom: {},
    notes: [],
  }),
  findMatchingLead,
  upsertLeadFromFormAnswers,
}))
mock.module("@/app/api/services/leadSchedule/LeadScheduleService", () => ({
  leadScheduleService: {},
}))
mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
  publicLeadFormUseCase: {},
}))
mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: { execute: attributionExecute },
}))
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: mock((_publicId: string, input: unknown) => input),
  publishServerPublicFormMetricEvent,
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

type MetricEvent = { eventType: string; eventKey: string; origin: { reason?: string } }

function completedMetricEvents(): MetricEvent[] {
  const [call] = completeSubmission.mock.calls as unknown as [[{ metricEvents: MetricEvent[] }]]
  return call[0].metricEvents
}

const JOB = {
  submissionId: "sub-discard",
  publicationId: PUBLICATION_ID,
  snapshot: makeSnapshot(),
  visibleAnswers: [{ questionId: Q_NAME, value: "Maria Silva" }],
  visibleIds: [Q_NAME],
  score: 0,
  scoreBandLabel: null,
  origin: {},
  requestKey: "progress:sessao-descarte:pub-1",
  visitorSessionId: "sessao-descarte",
}

describe("PublicFormSubmissionUseCase descarte de lead", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    delete process.env.PUBLIC_FORM_LEAD_GATE_MODE
    completeSubmission.mockClear()
    markSubmissionFailed.mockClear()
    upsertLeadFromFormAnswers.mockClear()
    upsertLeadFromFormAnswers.mockResolvedValue({ outcome: "discarded", reason: "sem_telefone" })
    publishServerPublicFormMetricEvent.mockClear()
    publishServerPublicFormMetricEvent.mockResolvedValue(true)
    attributionExecute.mockClear()
    attributionExecute.mockResolvedValue({ isValid: true, result: null })
  })

  // T-F2.1
  it("emite lead_discarded com o motivo junto do form_completed", async () => {
    await useCase.processInBackground(JOB)

    const events = completedMetricEvents()
    expect(events.map((event) => event.eventType)).toEqual(["form_completed", "lead_discarded"])
    const discarded = events.find((event) => event.eventType === "lead_discarded")
    expect(discarded?.origin.reason).toBe("sem_telefone")
  })

  // T-F2.1 (idempotência): o drain reprocessando o mesmo job não pode dobrar o contador.
  it("deriva o eventKey do requestKey — mesmo job reprocessado, mesma chave", async () => {
    await useCase.processInBackground(JOB)
    const first = completedMetricEvents().find((event) => event.eventType === "lead_discarded")

    completeSubmission.mockClear()
    await useCase.processInBackground(JOB)
    const second = completedMetricEvents().find((event) => event.eventType === "lead_discarded")

    expect(first?.eventKey).toBe(second?.eventKey)
    expect(first?.eventKey).toContain(JOB.requestKey)
  })

  it("lead criado não gera descarte", async () => {
    upsertLeadFromFormAnswers.mockResolvedValue({
      outcome: "created",
      lead: { id: "lead-1", name: "Maria Silva" },
    })

    await useCase.processInBackground(JOB)

    const types = completedMetricEvents().map((event) => event.eventType)
    expect(types).toContain("lead_created")
    expect(types).not.toContain("lead_discarded")
  })

  /**
   * Review #1040 (P1). No modo radar o upsert sai como `skipped` — quem promove
   * é o gate C. Checar só `outcome === "discarded"` deixava toda submissão de
   * time canário completada **sem par** no funil. A condição correta é "não
   * sobrou lead nenhum", e o motivo vem da identidade extraída.
   */
  it("modo radar sem lead resolvido também emite descarte", async () => {
    process.env.PUBLIC_FORM_LEAD_GATE_MODE = "radar"
    upsertLeadFromFormAnswers.mockResolvedValue({ outcome: "skipped" })

    try {
      await useCase.processInBackground(JOB)

      const events = completedMetricEvents()
      expect(events.map((event) => event.eventType)).toEqual(["form_completed", "lead_discarded"])
      expect(events[1]?.origin.reason).toBe("sem_telefone")
    } finally {
      delete process.env.PUBLIC_FORM_LEAD_GATE_MODE
    }
  })

  /**
   * Review #1040 (P1). A atribuição por `cs_el` resolve um lead existente mesmo
   * quando as respostas não têm identidade para o upsert. Antes, a mesma
   * conclusão saía como `lead_attached` **e** `lead_discarded` — um
   * `form_completed` com dois desfechos.
   */
  it("lead resolvido só pela atribuição não gera descarte junto", async () => {
    attributionExecute.mockResolvedValue({
      isValid: true,
      result: { leadId: "lead-atribuido", enrichedOrigin: {} },
    })

    await useCase.processInBackground(JOB)

    const types = completedMetricEvents().map((event) => event.eventType)
    expect(types).toContain("lead_attached")
    expect(types).not.toContain("lead_discarded")
  })
})
