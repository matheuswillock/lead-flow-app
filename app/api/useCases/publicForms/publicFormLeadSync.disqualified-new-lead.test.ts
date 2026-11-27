import { beforeEach, describe, expect, it } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  createLeadMock as createLead,
  findDeletedLeadCandidatesMock as findDeletedLeadCandidates,
  findLeadCandidatesMock as findLeadCandidates,
  registerPublicFormLeadSyncModuleMocks,
  updateLeadMock as updateLead,
} from "@/test/support/public-form-lead-sync-module-mocks"

/**
 * Lead desqualificado não recebe merge. Uma nova resposta do formulário cria
 * um lead novo (nova timeline) e o card desqualificado fica como estava, com o
 * histórico. Caso real (Forms 17.11): o Wellington foi desqualificado em
 * 21/09 e reenviou o formulário em 23/11; a resposta foi anexada ao card
 * antigo em vez de virar um lead novo.
 */

registerPublicFormLeadSyncModuleMocks()

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
  { questionId: Q_NAME, value: "Wellington" },
  { questionId: Q_EMAIL, value: "wellington@example.com" },
  { questionId: Q_PHONE, value: "11987654321" },
]

const DISQUALIFIED_LEAD = {
  id: "lead-desqualificado",
  name: "Wellington",
  email: "wellington@example.com",
  phone: "11987654321",
  notes: "Nota antiga",
  deletedAt: null,
  status: "disqualified",
  lossReason: "não tem dinheiro",
  statusEnteredAt: new Date("2026-09-21T20:39:02.853Z"),
}

const OPEN_LEAD = {
  ...DISQUALIFIED_LEAD,
  id: "lead-aberto",
  status: "new_opportunity",
  lossReason: null,
}

const NEW_LEAD = { ...DISQUALIFIED_LEAD, id: "lead-novo", status: "new_opportunity", lossReason: null }

const { upsertLeadFromFormAnswers } = await import("./publicFormLeadSync")
// Do módulo puro: o helper fica na fonte, como nos demais testes de sync.
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

describe("upsertLeadFromFormAnswers — lead desqualificado responde de novo", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    updateLead.mockReset()
    updateLead.mockImplementation(async (id, data) => ({ ...data, id }))
    createLead.mockReset()
    createLead.mockResolvedValue({
      isValid: true,
      errorMessages: [],
      successMessages: ["ok"],
      result: NEW_LEAD,
    })
  })

  it("não faz merge no card desqualificado e cria um lead novo", async () => {
    findLeadCandidates.mockResolvedValue([DISQUALIFIED_LEAD])

    const result = await callUpsert()

    expect(updateLead).not.toHaveBeenCalled()
    expect(createLead).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe("created")
    expect(leadFromUpsertOutcome(result)?.id).toBe("lead-novo")
  })

  it("create recusado por outra duplicata não faz merge no desqualificado (recuperação)", async () => {
    // A primeira busca não enxerga candidato aberto; a criação falha por um
    // conflito de CNPJ com outro lead aberto; a recuperação enxerga só o
    // desqualificado pelo e-mail. Ele não pode receber a resposta.
    findLeadCandidates.mockResolvedValue([DISQUALIFIED_LEAD])
    createLead.mockResolvedValue({
      isValid: false,
      errorMessages: ["Já existe um lead com este CNPJ neste time (X1234Y)"],
      successMessages: [],
      result: null,
    })

    await expect(callUpsert()).rejects.toThrow()
    expect(updateLead).not.toHaveBeenCalled()
  })

  it("com lead aberto no mesmo e-mail, anexa ao aberto e nunca ao desqualificado", async () => {
    findLeadCandidates.mockResolvedValue([DISQUALIFIED_LEAD, OPEN_LEAD])

    const result = await callUpsert()

    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).toHaveBeenCalledTimes(1)
    const [leadId] = updateLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(leadId).toBe("lead-aberto")
    expect(result.outcome).toBe("updated")
  })
})
