import { describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — E4/DA4, segunda metade da regra. `leadCaptureDisabled` não é só
 * "publica sem contato": é declarar que o formulário não faz captação. Se o
 * opt-out liberasse a publicação e o form continuasse criando lead, a exceção
 * viraria um jeito de burlar a validação — e o funil de lead do form mostraria
 * número onde não há promessa nenhuma.
 */

mock.module("server-only", () => ({}))
mock.module("@/lib/env/server", () => ({}))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const findLeadCandidates = mock(async () => [] as unknown[])
const createLead = mock(async () => ({
  isValid: true,
  errorMessages: [],
  successMessages: ["ok"],
  result: { id: "lead-1" },
}))

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: { findLeadCandidates, updateLead: mock(async () => ({ id: "lead-1" })) },
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

const { upsertLeadFromFormAnswers } = await import("./publicFormLeadSync")

const Q_NAME = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
const Q_PHONE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"

function snapshot(leadCaptureDisabled: boolean): PublicFormSnapshot {
  return {
    formId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leadCaptureDisabled,
    questions: [
      {
        id: Q_NAME,
        type: "text",
        title: "Nome",
        required: true,
        scoreWeight: 0,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "name",
      },
      {
        id: Q_PHONE,
        type: "phone",
        title: "WhatsApp",
        required: true,
        scoreWeight: 0,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "phone",
      },
    ],
    rules: [],
    scoreBands: [],
  } as unknown as PublicFormSnapshot
}

const FORM_CONTEXT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Pesquisa",
  publicId: "11111111-1111-4111-8111-111111111111",
  teamId: "team-1",
  assignedSdrId: null,
  emailCampaignTrackingEnabled: false,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
} as unknown as Parameters<typeof upsertLeadFromFormAnswers>[0]["form"]

function upsert(leadCaptureDisabled: boolean) {
  return upsertLeadFromFormAnswers({
    form: FORM_CONTEXT,
    snapshot: snapshot(leadCaptureDisabled),
    answers: [
      { questionId: Q_NAME, value: "Maria Silva" },
      { questionId: Q_PHONE, value: "11987654321" },
    ],
    visibleIds: new Set([Q_NAME, Q_PHONE]),
    publicationId: "pub-1",
    origin: {},
  })
}

describe("upsertLeadFromFormAnswers com captação desligada", () => {
  // T-F4.2
  it("não cria nem procura lead quando leadCaptureDisabled", async () => {
    findLeadCandidates.mockClear()
    createLead.mockClear()

    const result = await upsert(true)

    // `skipped`, não `discarded`: decisão de produto, não julgamento de
    // identidade — e é o que impede o descarte de ser emitido no completamento.
    expect(result).toEqual({ outcome: "skipped" })
    expect(findLeadCandidates).not.toHaveBeenCalled()
    expect(createLead).not.toHaveBeenCalled()
  })

  it("com captação ligada, o mesmo payload cria o lead", async () => {
    findLeadCandidates.mockClear()
    createLead.mockClear()

    const result = await upsert(false)

    expect(result.outcome).toBe("created")
    expect(createLead).toHaveBeenCalledTimes(1)
  })
})
