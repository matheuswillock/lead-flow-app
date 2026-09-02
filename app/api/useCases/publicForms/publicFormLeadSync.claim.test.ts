import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — claim atômico de lead-sync por submissão.
 *
 * Bug de produção (nota `2026-08-28-liber-leads-duplicados-origem-campanha-email.md`,
 * adenda 02/09): o renderer do `/progress` dispara DOIS POSTs da mesma sessão
 * com ~70ms de distância (blur + `page_advanced`). Os dois processamentos
 * chamam `findMatchingLead` (SELECT) antes de qualquer um commitar o create —
 * os dois criam lead. O catch de unique do T-F5.3 não cobre esse caminho
 * porque não existe (e não pode existir) unique de identidade em `Lead`.
 *
 * A correção reivindica a SUBMISSÃO atomicamente antes do create
 * (`claimSubmissionForLeadSync`, ver `lib/public-forms/lead-sync-claim.ts`).
 * Quem perde a corrida espera e re-resolve; se o vencedor nunca aparece,
 * cria mesmo assim.
 */

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const Q_NAME = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
const Q_EMAIL = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"
const Q_PHONE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd3"

const SNAPSHOT = {
  formId: FORM_ID,
  questions: [
    {
      id: Q_NAME,
      type: "text",
      title: "Nome",
      required: true,
      scoreWeight: 0,
      options: [],
      position: 0,
      mappingTarget: "native_field",
      mappingKey: "name",
    },
    {
      id: Q_EMAIL,
      type: "email",
      title: "E-mail",
      required: false,
      scoreWeight: 0,
      options: [],
      position: 1,
      mappingTarget: "native_field",
      mappingKey: "email",
    },
    {
      id: Q_PHONE,
      type: "phone",
      title: "Telefone",
      required: true,
      scoreWeight: 0,
      options: [],
      position: 2,
      mappingTarget: "native_field",
      mappingKey: "phone",
    },
  ],
  rules: [],
  scoreBands: [],
} as unknown as PublicFormSnapshot

const ANSWERS = [
  { questionId: Q_NAME, value: "ML Servicos de Arquitetura" },
  { questionId: Q_EMAIL, value: "kkj@example.com" },
  { questionId: Q_PHONE, value: "11964326587" },
]

const LIVE_LEAD = {
  id: "lead-vencedor",
  name: "ML Servicos de Arquitetura",
  email: "kkj@example.com",
  phone: "11964326587",
  notes: null,
  deletedAt: null,
}

const SUBMISSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

const findLeadCandidates = mock(async () => [] as unknown[])
const findDeletedLeadCandidates = mock(async () => [] as unknown[])
const updateLead = mock(async (id: string, data: Record<string, unknown>) => ({
  ...LIVE_LEAD,
  ...data,
  id,
}))
const findCustomFieldDefinitionId = mock(async () => null)
const upsertLeadCustomFieldValue = mock(async () => {})
const claimSubmissionForLeadSync = mock(async () => true)

type CreateLeadOutput = {
  isValid: boolean
  errorMessages: string[]
  successMessages: string[]
  result: unknown
}

const createLead = mock(
  async (): Promise<CreateLeadOutput> => ({
    isValid: true,
    errorMessages: [],
    successMessages: ["ok"],
    result: LIVE_LEAD,
  }),
)

const waitForLeadSyncClaimRetry = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findLeadCandidates,
    findDeletedLeadCandidates,
    updateLead,
    findCustomFieldDefinitionId,
    upsertLeadCustomFieldValue,
    claimSubmissionForLeadSync,
  },
}))
mock.module("@/app/api/useCases/leads/LeadUseCase", () => ({
  LeadUseCase: class {
    createLead = createLead
  },
}))
mock.module("@/app/api/infra/data/repositories/lead/LeadRepository", () => ({
  LeadRepository: class {},
}))
mock.module("@/app/api/useCases/profiles/ProfileUseCase", () => ({
  RegisterNewUserProfile: class {},
}))
mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: { findCampaignLogForAttribution: mock(async () => null) },
}))
// Mesmas constantes de produção (3×700ms) — só a espera vira no-op no teste,
// sem depender de env var de máquina nem de aguardar 2.1s de verdade.
mock.module("@/lib/public-forms/lead-sync-claim", () => ({
  LEAD_SYNC_CLAIM_RETRY_ATTEMPTS: 3,
  LEAD_SYNC_CLAIM_RETRY_DELAY_MS: 700,
  waitForLeadSyncClaimRetry,
}))

const { upsertLeadFromFormAnswers } = await import("./publicFormLeadSync")
const { leadFromUpsertOutcome } = await import("@/lib/public-forms/lead-upsert-outcome")

const FORM_CONTEXT = {
  id: FORM_ID,
  name: "Form",
  publicId: "11111111-1111-4111-8111-111111111111",
  teamId: "team-1",
  assignedSdrId: null,
  emailCampaignTrackingEnabled: false,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
} as unknown as Parameters<typeof upsertLeadFromFormAnswers>[0]["form"]

function callUpsert(submissionId?: string) {
  return upsertLeadFromFormAnswers({
    form: FORM_CONTEXT,
    snapshot: SNAPSHOT,
    answers: ANSWERS,
    visibleIds: new Set([Q_NAME, Q_EMAIL, Q_PHONE]),
    publicationId: "pub-1",
    origin: {},
    submissionId,
  })
}

describe("upsertLeadFromFormAnswers — claim atômico por submissão", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    updateLead.mockReset()
    updateLead.mockImplementation(async (id, data) => ({ ...LIVE_LEAD, ...data, id }))
    createLead.mockReset()
    createLead.mockResolvedValue({
      isValid: true,
      errorMessages: [],
      successMessages: ["ok"],
      result: LIVE_LEAD,
    })
    claimSubmissionForLeadSync.mockReset()
    claimSubmissionForLeadSync.mockResolvedValue(true)
    waitForLeadSyncClaimRetry.mockReset()
    waitForLeadSyncClaimRetry.mockResolvedValue(undefined)
  })

  it("duas chamadas concorrentes da mesma submissão: exatamente um create, um anexo", async () => {
    let claimed = false
    claimSubmissionForLeadSync.mockImplementation(async () => {
      if (claimed) return false
      claimed = true
      return true
    })
    let created = false
    createLead.mockImplementation(async () => {
      created = true
      return { isValid: true, errorMessages: [], successMessages: ["ok"], result: LIVE_LEAD }
    })
    // O perdedor só enxerga o vencedor depois que ele criou.
    findLeadCandidates.mockImplementation(async () => (created ? [LIVE_LEAD] : []))

    const [first, second] = await Promise.all([
      callUpsert(SUBMISSION_ID),
      callUpsert(SUBMISSION_ID),
    ])

    expect(claimSubmissionForLeadSync).toHaveBeenCalledTimes(2)
    expect(createLead).toHaveBeenCalledTimes(1)
    expect(leadFromUpsertOutcome(first)?.id).toBe("lead-vencedor")
    expect(leadFromUpsertOutcome(second)?.id).toBe("lead-vencedor")
    const outcomes = [first.outcome, second.outcome]
    expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome === "updated")).toHaveLength(1)
    // Nenhum throw, nenhuma duplicata: o dobro de leads que o P1 media não se repete.
  })

  it("perdedor do claim com vencedor morto: espera as 3 tentativas e cria mesmo assim, com log observável", async () => {
    claimSubmissionForLeadSync.mockResolvedValue(false)
    // O "vencedor" nunca commita — findMatchingLead nunca encontra nada.
    findLeadCandidates.mockResolvedValue([])
    const infoSpy = mock(() => {})
    const originalInfo = console.info
    console.info = infoSpy as unknown as typeof console.info
    try {
      const result = await callUpsert(SUBMISSION_ID)

      expect(waitForLeadSyncClaimRetry).toHaveBeenCalledTimes(3)
      expect(waitForLeadSyncClaimRetry).toHaveBeenCalledWith(700)
      expect(result.outcome).toBe("created")
      expect(
        infoSpy.mock.calls.some((call) =>
          call.some((arg) => String(arg).includes("lead_sync_claim_fallback_create")),
        ),
      ).toBe(true)
    } finally {
      console.info = originalInfo
    }
  })

  it("perdedor do claim encontra o vencedor numa das tentativas: anexa sem esgotar os retries", async () => {
    claimSubmissionForLeadSync.mockResolvedValue(false)
    // Chamada 1 = `findMatchingLead` inicial (antes do claim), ainda sem
    // match — é a corrida real: nenhum dos dois lados commitou ainda.
    // Chamada 2 = 1ª tentativa de retry, já enxerga o vencedor.
    let calls = 0
    findLeadCandidates.mockImplementation(async () => {
      calls += 1
      return calls >= 2 ? [LIVE_LEAD] : []
    })

    const result = await callUpsert(SUBMISSION_ID)

    expect(leadFromUpsertOutcome(result)?.id).toBe("lead-vencedor")
    expect(result.outcome).toBe("updated")
    expect(createLead).not.toHaveBeenCalled()
    // Achou na 1ª tentativa de retry: não precisou esgotar as 3.
    expect(waitForLeadSyncClaimRetry).toHaveBeenCalledTimes(1)
  })

  it("sem submissionId (call site legado): não reivindica, comportamento atual intacto", async () => {
    const result = await callUpsert(undefined)

    expect(claimSubmissionForLeadSync).not.toHaveBeenCalled()
    expect(waitForLeadSyncClaimRetry).not.toHaveBeenCalled()
    expect(createLead).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe("created")
  })
})
