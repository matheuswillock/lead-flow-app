import { beforeEach, describe, expect, it } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  findCampaignLogForAttributionMock as findCampaignLogForAttribution,
  findDeletedLeadCandidatesMock as findDeletedLeadCandidates,
  findLeadCandidatesMock as findLeadCandidates,
  registerPublicFormLeadSyncModuleMocks,
  updateLeadMock as updateLead,
} from "@/test/support/public-form-lead-sync-module-mocks"

/**
 * Requisitos 4/5/8 do bug `2026-08-28-liber-leads-duplicados-origem-campanha-
 * email.md` (caso Bruno Marcelino) — terceiro item do despacho E1b/E6b: quando
 * uma resposta atribuída por campanha (`cs_el`/`emailLogId`) ANEXA num lead
 * `public_form` existente, a origem é promovida para `email_campaign`, com
 * MERGE dos metadados anteriores. Lead que já é `email_campaign` não muda.
 *
 * Achado codex PR #1148 (P2): `emailLogId` vem da URL (`cs_el`) e é só um
 * UUID bem formado — a promoção exige o `EmailLog` verificado no time
 * (`findCampaignLogForAttribution`); token forjado não promove nada.
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
  { questionId: Q_NAME, value: "Bruno Marcelino" },
  { questionId: Q_EMAIL, value: "bruno@example.com" },
  { questionId: Q_PHONE, value: "11939534668" },
]

// Caso real: lead nasceu `public_form` (link direto), depois respondeu de
// novo pelo link da campanha — mesmo telefone/e-mail.
const PUBLIC_FORM_LEAD = {
  id: "lead-bruno",
  name: "Bruno Marcelino",
  email: "bruno@example.com",
  phone: "11939534668",
  notes: null,
  deletedAt: null,
  originChannel: "public_form",
  originMetadata: { source: "Form X", formId: "form-antigo", firstFormAt: "2026-08-28T11:10:29Z" },
}

const FORM_CONTEXT = {
  id: FORM_ID,
  name: "Form",
  publicId: "11111111-1111-4111-8111-111111111111",
  teamId: "team-1",
  assignedSdrId: null,
  emailCampaignTrackingEnabled: true,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
} as unknown as Parameters<
  typeof import("./publicFormLeadSync").upsertLeadFromFormAnswers
>[0]["form"]

const { upsertLeadFromFormAnswers } = await import("./publicFormLeadSync")

function callUpsert(origin: Record<string, unknown>) {
  return upsertLeadFromFormAnswers({
    form: FORM_CONTEXT,
    snapshot: SNAPSHOT,
    answers: ANSWERS,
    visibleIds: new Set([Q_NAME, Q_EMAIL, Q_PHONE]),
    publicationId: "pub-1",
    origin,
  })
}

describe("upsertLeadFromFormAnswers — promoção de origem no anexo (item 3)", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([PUBLIC_FORM_LEAD])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    updateLead.mockReset()
    updateLead.mockImplementation(async (id, data) => ({ ...PUBLIC_FORM_LEAD, ...data, id }))
    findCampaignLogForAttribution.mockReset()
    // EmailLog verificado no time — pré-condição da promoção.
    findCampaignLogForAttribution.mockResolvedValue({
      id: "emaillog-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "bruno@example.com",
      recipientName: "Bruno Marcelino",
      campaignName: "Campanha X",
    })
  })

  it("anexo com atribuição de campanha promove originChannel preservando metadados anteriores", async () => {
    const result = await callUpsert({ emailLogId: "emaillog-1", campaignId: "campaign-1" })

    expect(result.outcome).toBe("updated")
    expect(updateLead).toHaveBeenCalledTimes(1)
    const [, data] = updateLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(data.originChannel).toBe("email_campaign")
    const metadata = data.originMetadata as Record<string, unknown>
    expect(metadata).toMatchObject({
      source: "Form X",
      formId: "form-antigo",
      firstFormAt: "2026-08-28T11:10:29Z",
      attribution: "email_campaign",
      emailLogId: "emaillog-1",
      campaignId: "campaign-1",
    })
  })

  it("idempotente: re-anexo com a MESMA atribuição não duplica nem regride nada", async () => {
    const alreadyPromoted = {
      ...PUBLIC_FORM_LEAD,
      originChannel: "email_campaign",
      originMetadata: {
        source: "Form X",
        attribution: "email_campaign",
        emailLogId: "emaillog-1",
        campaignId: "campaign-1",
      },
    }
    findLeadCandidates.mockResolvedValue([alreadyPromoted])

    const result = await callUpsert({ emailLogId: "emaillog-1", campaignId: "campaign-1" })

    expect(result.outcome).toBe("updated")
    const [, data] = updateLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    // Sem campos de origem no payload — nada a mudar, nenhuma escrita redundante.
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })

  it("controle: anexo SEM atribuição de campanha não toca a origem", async () => {
    const result = await callUpsert({})

    expect(result.outcome).toBe("updated")
    const [, data] = updateLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })

  // Achado codex PR #1148 (P2): UUID forjado na URL passa no formato do
  // sanitizador, mas não existe EmailLog do time — sem log verificado a
  // origem do lead existente não pode ser reescrita.
  it("emailLogId forjado (EmailLog inexistente no time) → anexa sem promover a origem", async () => {
    findCampaignLogForAttribution.mockResolvedValue(null)

    const result = await callUpsert({
      emailLogId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      campaignId: "campaign-forjado",
    })

    expect(result.outcome).toBe("updated")
    const [, data] = updateLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })
})
