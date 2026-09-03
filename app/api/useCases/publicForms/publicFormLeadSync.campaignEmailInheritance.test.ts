import { beforeEach, describe, expect, it } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import {
  createLeadMock as createLead,
  findCampaignLogForAttributionMock as findCampaignLogForAttribution,
  findDeletedLeadCandidatesMock as findDeletedLeadCandidates,
  findLeadCandidatesMock as findLeadCandidates,
  registerPublicFormLeadSyncModuleMocks,
} from "@/test/support/public-form-lead-sync-module-mocks"

/**
 * Adenda E1b (SPEC 40, decisão do owner 02/09) — caso real ML SERVICOS DE
 * ARQUITETURA/KKJ: lead de campanha nasceu só com telefone porque o
 * formulário não coletou e-mail, mas o `cs_el` da submissão sabia exatamente
 * quem era o destinatário (`recipientEmail`) a um join de distância.
 *
 * Regra: submissão de campanha (`cs_el`/`emailLogId`) sem e-mail extraído
 * herda `recipientEmail` do `EmailLog`, marcado como inferido
 * (`emailSource: "campaign_recipient"`) — só quando a identidade digitada não
 * diverge do destinatário (guarda do #1107, `typed-identity-divergence.ts`,
 * via `lib/radar/campaign-recipient-identity.ts`). E-mail digitado sempre
 * vence.
 *
 * Mocks de módulo compartilhados — mesmo singleton do `publicFormLeadSync`
 * usado por `publicFormLeadSync.claim.test.ts`/`.duplicate.test.ts`.
 */
registerPublicFormLeadSyncModuleMocks()

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const Q_NAME = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
const Q_PHONE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd3"
const Q_FREE_TEXT = "dddddddd-dddd-4ddd-8ddd-ddddddddddd4"

// Formulário SEM pergunta de e-mail mapeada — premissa literal da Adenda E1b.
const SNAPSHOT_NO_EMAIL_FIELD = {
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
      id: Q_PHONE,
      type: "phone",
      title: "Telefone",
      required: true,
      scoreWeight: 0,
      options: [],
      position: 1,
      mappingTarget: "native_field",
      mappingKey: "phone",
    },
    {
      id: Q_FREE_TEXT,
      type: "text",
      title: "Alguma observação?",
      required: false,
      scoreWeight: 0,
      options: [],
      position: 2,
      mappingTarget: "notes",
    },
  ],
  rules: [],
  scoreBands: [],
} as unknown as PublicFormSnapshot

const CREATED_LEAD = {
  id: "lead-novo",
  name: "ML Servicos de Arquitetura",
  email: null,
  phone: "11964326587",
  notes: null,
  deletedAt: null,
}

const RECIPIENT_LOG = {
  id: "emaillog-1",
  campaignId: "campaign-1",
  dispatchId: "dispatch-1",
  recipientEmail: "marianalombardi@uol.com.br",
  recipientName: "Mariana Lombardi",
  campaignName: "Guarulhos (parte 2/3)",
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

function callUpsert(input: {
  answers: Array<{ questionId: string; value: unknown }>
  origin: Record<string, unknown>
  snapshot?: PublicFormSnapshot
}) {
  const snapshot = input.snapshot ?? SNAPSHOT_NO_EMAIL_FIELD
  return upsertLeadFromFormAnswers({
    form: FORM_CONTEXT,
    snapshot,
    answers: input.answers,
    visibleIds: new Set(snapshot.questions.map((question) => question.id)),
    publicationId: "pub-1",
    origin: input.origin,
  })
}

describe("upsertLeadFromFormAnswers — herança de e-mail do destinatário (E1b)", () => {
  beforeEach(() => {
    findLeadCandidates.mockReset()
    findLeadCandidates.mockResolvedValue([])
    findDeletedLeadCandidates.mockReset()
    findDeletedLeadCandidates.mockResolvedValue([])
    createLead.mockReset()
    createLead.mockResolvedValue({
      isValid: true,
      errorMessages: [],
      successMessages: ["ok"],
      result: CREATED_LEAD,
    })
    findCampaignLogForAttribution.mockReset()
    findCampaignLogForAttribution.mockResolvedValue(RECIPIENT_LOG)
  })

  // T-F1.8
  it("campanha + sem e-mail digitado + identidade convergente → lead herda recipientEmail marcado como inferido", async () => {
    const result = await callUpsert({
      answers: [
        { questionId: Q_NAME, value: "ML Servicos de Arquitetura" },
        { questionId: Q_PHONE, value: "11964326587" },
      ],
      origin: { emailLogId: RECIPIENT_LOG.id, campaignId: RECIPIENT_LOG.campaignId },
    })

    expect(result.outcome).toBe("created")
    expect(createLead).toHaveBeenCalledTimes(1)
    const [, createData] = createLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(createData.email).toBe(RECIPIENT_LOG.recipientEmail)
    const originMetadata = createData.originMetadata as Record<string, unknown>
    expect(originMetadata.emailSource).toBe("campaign_recipient")
  })

  // T-F1.9
  it("identidade divergente (encaminhamento) → e-mail do destinatário NÃO é herdado", async () => {
    const result = await callUpsert({
      answers: [
        { questionId: Q_NAME, value: "Outra Pessoa" },
        { questionId: Q_PHONE, value: "11999998888" },
        // Texto solto com cara de e-mail, mas de OUTRA pessoa — pergunta sem
        // mapping de e-mail (mappingTarget: "notes"), exatamente o padrão do
        // caso KKJ/E6b: o respondente escreveu o próprio e-mail onde não era
        // esperado, e ele diverge do destinatário do disparo.
        { questionId: Q_FREE_TEXT, value: "outrapessoa@example.com" },
      ],
      origin: { emailLogId: RECIPIENT_LOG.id, campaignId: RECIPIENT_LOG.campaignId },
    })

    expect(result.outcome).toBe("created")
    const [, createData] = createLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(createData.email).toBeUndefined()
    const originMetadata = createData.originMetadata as Record<string, unknown>
    expect(originMetadata.emailSource).toBeUndefined()
  })

  // T-F1.10
  it("e-mail digitado (formulário COM pergunta de e-mail) sempre vence o do destinatário", async () => {
    const Q_EMAIL = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"
    const snapshotWithEmail = {
      ...SNAPSHOT_NO_EMAIL_FIELD,
      questions: [
        ...SNAPSHOT_NO_EMAIL_FIELD.questions,
        {
          id: Q_EMAIL,
          type: "email",
          title: "E-mail",
          required: false,
          scoreWeight: 0,
          options: [],
          position: 3,
          mappingTarget: "native_field",
          mappingKey: "email",
        },
      ],
    } as unknown as PublicFormSnapshot

    const result = await callUpsert({
      snapshot: snapshotWithEmail,
      answers: [
        { questionId: Q_NAME, value: "ML Servicos de Arquitetura" },
        { questionId: Q_PHONE, value: "11964326587" },
        { questionId: Q_EMAIL, value: "proprio@example.com" },
      ],
      origin: { emailLogId: RECIPIENT_LOG.id, campaignId: RECIPIENT_LOG.campaignId },
    })

    expect(result.outcome).toBe("created")
    const [, createData] = createLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(createData.email).toBe("proprio@example.com")
    const originMetadata = createData.originMetadata as Record<string, unknown>
    expect(originMetadata.emailSource).toBeUndefined()
  })

  it("sem emailLogId no origin (não é campanha) → não herda nem chama findCampaignLogForAttribution", async () => {
    const result = await callUpsert({
      answers: [
        { questionId: Q_NAME, value: "Fulano" },
        { questionId: Q_PHONE, value: "11988887777" },
      ],
      origin: {},
    })

    expect(result.outcome).toBe("created")
    expect(findCampaignLogForAttribution).not.toHaveBeenCalled()
    const [, createData] = createLead.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(createData.email).toBeUndefined()
  })
})
