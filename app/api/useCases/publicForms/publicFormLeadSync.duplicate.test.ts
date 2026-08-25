import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

/**
 * SPEC 40 — E5/DA3. Duplicata no caminho A anexa, nunca lança.
 *
 * O consumer de progress morria em loop com "Ja existe um lead com este
 * e-mail" (auditoria F9): `createLead` devolve `isValid:false` quando a unique
 * `Lead(teamId, email)` dispara, e `upsertLeadFromFormAnswers` transformava
 * isso em `throw` — mensagem envenenada retentando para sempre.
 *
 * A corrida é esperada numa fila at-least-once (dois eventos concorrentes, ou
 * candidato invisível ao `findMatchingLead`). A resposta certa é re-resolver e
 * anexar, idempotente.
 *
 * A unique inclui soft-deletados, então há um segundo caso: o único conflito é
 * um lead na lixeira. Ele não recebe update de identidade — vira anexo com
 * nota, porque restaurar é gesto do usuário (DA3).
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
  { questionId: Q_NAME, value: "Maria Silva" },
  { questionId: Q_EMAIL, value: "maria@example.com" },
  { questionId: Q_PHONE, value: "11987654321" },
]

const LIVE_LEAD = {
  id: "lead-vivo",
  name: "Maria Silva",
  email: "maria@example.com",
  phone: "11987654321",
  notes: null,
  deletedAt: null,
}
const DELETED_LEAD = {
  id: "lead-lixeira",
  name: "Maria Silva",
  email: "maria@example.com",
  phone: "11987654321",
  notes: "Nota antiga",
  deletedAt: new Date("2026-08-01T00:00:00.000Z"),
}

const findLeadCandidates = mock(async () => [] as unknown[])
const findDeletedLeadCandidates = mock(async () => [] as unknown[])
const updateLead = mock(async (_id: string, data: Record<string, unknown>) => ({
  ...LIVE_LEAD,
  ...data,
}))
const findCustomFieldDefinitionId = mock(async () => null)
const upsertLeadCustomFieldValue = mock(async () => {})
const createLead = mock(async () => ({
  isValid: false,
  errorMessages: ["Ja existe um lead com este e-mail"],
  successMessages: [],
  result: null,
}))

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findLeadCandidates,
    findDeletedLeadCandidates,
    updateLead,
    findCustomFieldDefinitionId,
    upsertLeadCustomFieldValue,
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

const { upsertLeadFromFormAnswers } = await import("./publicFormLeadSync")

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

function callUpsert() {
  return upsertLeadFromFormAnswers({
    form: FORM_CONTEXT,
    snapshot: SNAPSHOT,
    answers: ANSWERS,
    visibleIds: new Set([Q_NAME, Q_EMAIL, Q_PHONE]),
    publicationId: "pub-1",
    origin: {},
  })
}

describe("upsertLeadFromFormAnswers duplicata", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    updateLead.mockReset()
    updateLead.mockImplementation(async (_id, data) => ({ ...LIVE_LEAD, ...data }))
    createLead.mockReset()
    createLead.mockResolvedValue({
      isValid: false,
      errorMessages: ["Ja existe um lead com este e-mail"],
      successMessages: [],
      result: null,
    })
  })

  // T-F5.1
  it("duplicata no create re-resolve e anexa, sem lançar", async () => {
    // Primeira busca não enxerga (corrida); a de reconciliação enxerga.
    findLeadCandidates.mockResolvedValueOnce([]).mockResolvedValueOnce([LIVE_LEAD])

    const result = await callUpsert()

    expect(result).not.toBeNull()
    expect(result?.lead.id).toBe("lead-vivo")
    expect(result?.created).toBe(false)
  })

  // T-F5.2
  it("lead só na lixeira vira anexo-com-nota, sem update de identidade", async () => {
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockResolvedValue([DELETED_LEAD])

    const result = await callUpsert()

    expect(result?.lead.id).toBe("lead-lixeira")
    expect(updateLead).toHaveBeenCalledTimes(1)
    const [leadId, data] = updateLead.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ]
    expect(leadId).toBe("lead-lixeira")
    // Só a nota: nome/e-mail/telefone do lead deletado ficam intactos, e o
    // `deletedAt` não é tocado — restaurar é gesto do usuário.
    expect(Object.keys(data)).toEqual(["notes"])
    expect(String(data.notes)).toContain("lixeira")
  })

  // T-F5.2 (o filtro que evita o vazamento): candidato deletado nunca é match direto.
  it("não atualiza lead deletado pelo caminho normal de match", async () => {
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockResolvedValue([])
    createLead.mockResolvedValue({
      isValid: true,
      errorMessages: [],
      successMessages: ["ok"],
      result: LIVE_LEAD,
    })

    const result = await callUpsert()

    expect(result?.created).toBe(true)
    expect(updateLead).not.toHaveBeenCalled()
  })

  it("erro que não é duplicata continua lançando", async () => {
    createLead.mockResolvedValue({
      isValid: false,
      errorMessages: ["Master do time sem identificação"],
      successMessages: [],
      result: null,
    })

    await expect(callUpsert()).rejects.toThrow("Master do time sem identificação")
  })
})
