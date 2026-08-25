import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * `occurredAt` do `form_completed` server-side (SPEC 30 — DA3).
 *
 * O evento nasce em `processInBackground`, que roda quando a fila drena — não
 * quando o visitante aceitou. Sem `occurredAt`, a conversão conta no dia do
 * processamento: o drain de 22/08 às 23:05 UTC jogou ~105 conversões aceitas
 * em 20-21/08 para o dia 22, e o funil de três dias mostrou mais `form_completed`
 * do que `form_viewed`. Estes testes travam o relógio no aceite.
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
const SUBMISSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

/** Cenário congelado Kathrein/GPS: aceite em 20/08, drain da fila em 22/08. */
const ACEITE = new Date("2026-08-20T22:10:31.000Z")
const DRAIN = new Date("2026-08-22T23:07:04.000Z")

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

const completeSubmission = mock(async (_input: unknown) => {})
const findSubmissionAcceptedAt = mock(async (_id: string) => ({
  createdAt: ACEITE,
  dispatchAcceptedAt: null as Date | null,
}))

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
  publicFormsService: { getPublic: mock(async () => null) },
}))

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findFormSubmissionContext,
    findSubmissionAcceptedAt,
    completeSubmission,
    findLeadForSubmission: mock(async () => null),
    markSubmissionFailed: mock(async () => {}),
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

const buildPayload = mock((_publicId: string, input: Record<string, unknown>) => ({ ...input }))
const publishServerPublicFormMetricEvent = mock(async () => true)
mock.module("@/lib/queues/public-form-metric-events", () => ({
  buildPublicFormMetricQueuePayload: buildPayload,
  publishServerPublicFormMetricEvent,
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))
mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: mock(() => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

function job() {
  return {
    submissionId: SUBMISSION_ID,
    publicationId: PUBLICATION_ID,
    snapshot: makeSnapshot(),
    visibleAnswers: [{ questionId: QUESTION_ID, value: "Ana" }],
    visibleIds: [QUESTION_ID],
    score: 0,
    scoreBandLabel: null,
    origin: {} as Record<string, unknown>,
    requestKey: "req-1",
    visitorSessionId: "session-1",
  }
}

type PersistedMetricEvent = { eventType: string; occurredAt?: Date | null }

function persistedEvents(): PersistedMetricEvent[] {
  const call = completeSubmission.mock.calls.at(-1) as unknown as [
    { metricEvents: PersistedMetricEvent[] },
  ]
  return call[0].metricEvents
}

describe("PublicFormSubmissionUseCase.processInBackground — relógio do aceite", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    completeSubmission.mockClear()
    buildPayload.mockClear()
    publishServerPublicFormMetricEvent.mockClear()
    findSubmissionAcceptedAt.mockClear()
    findSubmissionAcceptedAt.mockImplementation(async () => ({
      createdAt: ACEITE,
      dispatchAcceptedAt: null,
    }))
  })

  it("T-M3.1 — form_completed persistido carrega o createdAt da submissão", async () => {
    await useCase.processInBackground(job())

    const completed = persistedEvents().find((event) => event.eventType === "form_completed")
    expect(completed).toBeDefined()
    expect(completed?.occurredAt).toEqual(ACEITE)
  })

  it("T-M3.2 — drain atrasado não muda o dia da conversão (Kathrein/GPS)", async () => {
    // A fila destravou dois dias depois; o evento continua contando em 20/08.
    await useCase.processInBackground(job())

    const completed = persistedEvents().find((event) => event.eventType === "form_completed")
    expect(completed?.occurredAt?.toISOString()).toBe(ACEITE.toISOString())
    expect(completed?.occurredAt?.getTime()).toBeLessThan(DRAIN.getTime())

    // O espelho no Radar viaja pela fila: sem `occurredAt` no payload o consumer
    // usa `new Date()` e o evento do Radar volta a nascer no dia do drain.
    const payload = buildPayload.mock.calls.at(-1) as unknown as [
      string,
      { occurredAt?: string },
    ]
    expect(payload[1].occurredAt).toBe(ACEITE.toISOString())
  })

  it("T-M3.3-unit — sem dispatchAcceptedAt, cai no createdAt (nunca no relógio do processamento)", async () => {
    findSubmissionAcceptedAt.mockImplementation(async () => ({
      createdAt: ACEITE,
      dispatchAcceptedAt: null,
    }))

    await useCase.processInBackground(job())

    const completed = persistedEvents().find((event) => event.eventType === "form_completed")
    expect(completed?.occurredAt).toEqual(ACEITE)
  })

  it("T-M3.4 — parcial promovida do /progress data pelo envio, não pelo início do preenchimento", async () => {
    // Aqui `createdAt` é quando o visitante abriu o formulário e começou a
    // digitar; o envio veio 3h depois. Datar pelo `createdAt` anteciparia a
    // conversão em três horas — e, num preenchimento retomado no dia seguinte,
    // em um dia inteiro. Como `createdAt` nunca é nulo, uma reserva depois dele
    // jamais seria alcançada.
    const comecouAPreencher = new Date("2026-08-20T19:05:00.000Z")
    const enviou = new Date("2026-08-20T22:10:31.000Z")
    findSubmissionAcceptedAt.mockImplementation(async () => ({
      createdAt: comecouAPreencher,
      dispatchAcceptedAt: enviou,
    }))

    await useCase.processInBackground(job())

    const completed = persistedEvents().find((event) => event.eventType === "form_completed")
    expect(completed?.occurredAt).toEqual(enviou)
  })
})
