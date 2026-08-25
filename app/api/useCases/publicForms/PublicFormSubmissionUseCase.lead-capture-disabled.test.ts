import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — E4/DA4, review #1043 (P1).
 *
 * O early-return dentro do sync de lead não fechava a porta sozinho: no
 * completamento, a atribuição por `cs_el` resolve um lead existente **sem**
 * passar por identidade nenhuma, e esse id ia para `lead_attached`, para o
 * `leadId` da submissão e para a activity. Um formulário de pesquisa divulgado
 * por campanha continuava ligando lead no CRM — exatamente o que o opt-out
 * promete não fazer.
 *
 * A atribuição continua rodando: o funil de campanha depende dela. O que ela
 * não faz mais é resolver lead quando a captação está desligada.
 */

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const Q_NAME = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"

function snapshot(leadCaptureDisabled: boolean): PublicFormSnapshot {
  return {
    formId: FORM_ID,
    publicId: PUBLIC_ID,
    version: 1,
    leadCaptureDisabled,
    questions: [
      {
        id: Q_NAME,
        type: "text",
        title: "Nome",
        required: true,
        scoreWeight: 0,
        options: [],
        position: 0,
      },
    ],
    rules: [],
    scoreBands: [],
  } as unknown as PublicFormSnapshot
}

// Devolve o lote recebido: `completeSubmission` passou a retornar o que de fato
// persistiu, e o caller enfileira esse retorno (review #1058).
const completeSubmission = mock(async (input: { metricEvents: unknown[] }) => input.metricEvents)
const attributionExecute = mock(
  async () =>
    ({ isValid: true, result: null }) as {
      isValid: boolean
      result: { leadId: string; enrichedOrigin: Record<string, unknown> } | null
    },
)
const upsertLeadFromFormAnswers = mock(async () => null)

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { getPublic: mock(async () => null) },
}))
mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findFormSubmissionContext: mock(async () => ({
      id: FORM_ID,
      name: "Pesquisa",
      publicId: PUBLIC_ID,
      teamId: "team-1",
      assignedSdrId: null,
      emailCampaignTrackingEnabled: true,
      assignedSdr: null,
      team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
    })),
    findLeadForSubmission: mock(async () => null),
    completeSubmission,
    markSubmissionFailed: mock(async () => {}),
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
  findMatchingLead: mock(async () => undefined),
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
  publishServerPublicFormMetricEvent: mock(async () => true),
}))
mock.module("@/lib/public-forms/queue-submission-for-background-processing", () => ({
  queueSubmissionForBackgroundProcessing: mock(async () => {}),
}))

const { PublicFormSubmissionUseCase } = await import("./PublicFormSubmissionUseCase")

function jobFor(leadCaptureDisabled: boolean) {
  return {
    submissionId: "sub-pesquisa",
    publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    snapshot: snapshot(leadCaptureDisabled),
    visibleAnswers: [{ questionId: Q_NAME, value: "Maria Silva" }],
    visibleIds: [Q_NAME],
    score: 0,
    scoreBandLabel: null,
    origin: { emailLogId: "log-1" },
    requestKey: "req-pesquisa",
    visitorSessionId: "sessao-pesquisa",
  }
}

type CompleteCall = [{ leadId: string | null; metricEvents: Array<{ eventType: string }> }]

describe("processInBackground com leadCaptureDisabled", () => {
  const useCase = new PublicFormSubmissionUseCase()

  beforeEach(() => {
    completeSubmission.mockClear()
    attributionExecute.mockClear()
    attributionExecute.mockResolvedValue({
      isValid: true,
      result: { leadId: "lead-da-campanha", enrichedOrigin: {} },
    })
  })

  it("não liga o lead resolvido pela atribuição de campanha", async () => {
    await useCase.processInBackground(jobFor(true))

    const [call] = completeSubmission.mock.calls as unknown as [CompleteCall]
    expect(call[0].leadId).toBeNull()
    expect(call[0].metricEvents.map((event) => event.eventType)).toEqual(["form_completed"])
  })

  it("com captação ligada, a mesma atribuição continua anexando", async () => {
    await useCase.processInBackground(jobFor(false))

    const [call] = completeSubmission.mock.calls as unknown as [CompleteCall]
    expect(call[0].leadId).toBe("lead-da-campanha")
    expect(call[0].metricEvents.map((event) => event.eventType)).toContain("lead_attached")
  })
})
