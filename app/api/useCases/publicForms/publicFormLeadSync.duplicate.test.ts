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

// Mocks de módulo COMPARTILHADOS (mesmo helper do claim.test): sem `--isolate`
// o `publicFormLeadSync` real é avaliado uma única vez e liga o singleton às
// instâncias do primeiro arquivo — instâncias próprias aqui deixariam os mocks
// do outro arquivo inertes conforme a ordem do runner.
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

type CreateLeadOutput = {
  isValid: boolean
  errorMessages: string[]
  successMessages: string[]
  result: unknown
}

const DUPLICATE_OUTPUT: CreateLeadOutput = {
  isValid: false,
  errorMessages: ["Ja existe um lead com este e-mail"],
  successMessages: [],
  result: null,
}

const { upsertLeadFromFormAnswers, DELETED_LEAD_ATTACH_NOTE } =
  await import("./publicFormLeadSync")
// Do módulo puro: o mock acima troca `publicFormLeadSync` em outros testes, mas
// aqui é o módulo real — mesmo assim o helper vem da fonte, não do re-export.
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

describe("upsertLeadFromFormAnswers duplicata", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    updateLead.mockReset()
    updateLead.mockImplementation(async (id, data) => ({ ...LIVE_LEAD, ...data, id }))
    createLead.mockReset()
    createLead.mockResolvedValue(DUPLICATE_OUTPUT)
  })

  // T-F5.1
  it("duplicata no create re-resolve e anexa, sem lançar", async () => {
    // Primeira busca não enxerga (corrida); a de reconciliação enxerga.
    findLeadCandidates.mockResolvedValueOnce([]).mockResolvedValueOnce([LIVE_LEAD])

    const result = await callUpsert()

    expect(result.outcome).toBe("updated")
    expect(leadFromUpsertOutcome(result)?.id).toBe("lead-vivo")
  })

  // T-F5.2
  it("lead só na lixeira vira anexo-com-nota, sem update de identidade", async () => {
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockResolvedValue([DELETED_LEAD])

    const result = await callUpsert()

    expect(leadFromUpsertOutcome(result)?.id).toBe("lead-lixeira")
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

    expect(result.outcome).toBe("created")
    expect(updateLead).not.toHaveBeenCalled()
  })

  /**
   * T-F5.3 — a corrida que gerava o poison: dois eventos de progress da mesma
   * sessão chegam juntos, os dois passam pelo `findMatchingLead` sem achar
   * nada, e os dois tentam criar. Um ganha a unique, o outro reconcilia. Zero
   * throw, um lead só.
   */
  it("dois eventos concorrentes para o mesmo e-mail: 1 lead, 0 erro", async () => {
    let created = false
    createLead.mockImplementation(async () => {
      if (created) return DUPLICATE_OUTPUT
      created = true
      return { isValid: true, errorMessages: [], successMessages: ["ok"], result: LIVE_LEAD }
    })
    // O perdedor da corrida só enxerga o vencedor na reconciliação.
    findLeadCandidates.mockImplementation(async () => (created ? [LIVE_LEAD] : []))

    const [first, second] = await Promise.all([callUpsert(), callUpsert()])

    expect(leadFromUpsertOutcome(first)?.id).toBe("lead-vivo")
    expect(leadFromUpsertOutcome(second)?.id).toBe("lead-vivo")
    // Um cria, o outro reconcilia: exatamente um `created`.
    expect([first.outcome, second.outcome].filter((outcome) => outcome === "created")).toHaveLength(
      1,
    )
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

  /**
   * Review #1042 (P1). O caso que a versão anterior mascarava: erro **não**
   * relacionado a unique, mas existe um lead na lixeira com o mesmo e-mail. Só
   * "achou lead conflitante" bastava para anexar, e a falha real de validação
   * virava sucesso silencioso. Agora são duas condições.
   */
  it("erro não-duplicata com lead na lixeira ainda lança, sem anexar", async () => {
    findDeletedLeadCandidates.mockResolvedValue([DELETED_LEAD])
    createLead.mockResolvedValue({
      isValid: false,
      errorMessages: ["Plano de saúde inválido"],
      successMessages: [],
      result: null,
    })

    await expect(callUpsert()).rejects.toThrow("Plano de saúde inválido")
    expect(updateLead).not.toHaveBeenCalled()
  })

  /**
   * Review #1042 (P2). O drain reprocessa o mesmo job; a frase fixa acabaria
   * repetida a cada passagem até tomar conta das notas do lead.
   */
  it("não repete a nota quando o lead da lixeira já a tem", async () => {
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockResolvedValue([
      { ...DELETED_LEAD, notes: `Nota antiga\n${DELETED_LEAD_ATTACH_NOTE}` },
    ])

    const result = await callUpsert()

    expect(leadFromUpsertOutcome(result)?.id).toBe("lead-lixeira")
    expect(updateLead).not.toHaveBeenCalled()
  })
})
