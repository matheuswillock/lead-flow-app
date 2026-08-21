import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NAME_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PHONE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

function makeSnapshot(): PublicFormSnapshot {
  return {
    formId: FORM_ID,
    publicId: "11111111-1111-4111-8111-111111111111",
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
        id: NAME_ID,
        type: "text",
        title: "Nome",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 0,
        mappingTarget: "native_field",
        mappingKey: "name",
      },
      {
        id: PHONE_ID,
        type: "phone",
        title: "Telefone",
        required: false,
        scoreWeight: 0,
        options: [],
        position: 1,
        mappingTarget: "native_field",
        mappingKey: "phone",
      },
    ],
    rules: [],
    scoreBands: [],
  }
}

const snapshot = makeSnapshot()
const findPublicationById = mock(async () => ({
  publicationId: PUBLICATION_ID,
  version: 1,
  snapshot,
}))
const findLatestSessionSubmissionOnForm = mock(async () => ({
  id: "sub-1",
  leadId: null as string | null,
}))
const listSubmissionAnswers = mock(async () => [] as Array<{ questionId: string; value: unknown }>)
const findFormSubmissionContext = mock(async () => ({
  id: FORM_ID,
  name: "Form",
  publicId: "11111111-1111-4111-8111-111111111111",
  teamId: "team-1",
  assignedSdrId: null,
  emailCampaignTrackingEnabled: false,
  assignedSdr: null,
  team: { master: { id: "m1", supabaseId: "s1", timezone: "America/Sao_Paulo" } },
}))
const attachLeadIdToSessionSubmission = mock(async () => ({ id: "sub-1", leadId: "lead-1" }))
const findProfileForFormLeadGate = mock(async () => null as {
  id: string
  displayName: string
  displayPhone: string | null
  normalizedPhone: string | null
  primaryEmail: string | null
  identities: Array<{ type: string; value: string | null; normalizedValue: string }>
} | null)
const tryClaimLeadIdentity = mock(async () => true)
const upsertLeadFromFormAnswers = mock(async () => null as {
  lead: { id: string }
  created: boolean
} | null)

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublicationById,
    findLatestSessionSubmissionOnForm,
    listSubmissionAnswers,
    findFormSubmissionContext,
    attachLeadIdToSessionSubmission,
  },
}))

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    findProfileForFormLeadGate,
    tryClaimLeadIdentity,
  },
}))

mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  upsertLeadFromFormAnswers,
}))

const { createCrmLeadFromRadarFormGateUseCase } = await import(
  "./CreateCrmLeadFromRadarFormGateUseCase"
)

const baseInput = {
  teamId: "team-1",
  formId: FORM_ID,
  publicationId: PUBLICATION_ID,
  visitorSessionId: "session-1",
  origin: {},
  profileId: "profile-1",
}

describe("CreateCrmLeadFromRadarFormGateUseCase", () => {
  beforeEach(() => {
    findPublicationById.mockClear()
    findLatestSessionSubmissionOnForm.mockClear()
    listSubmissionAnswers.mockClear()
    findFormSubmissionContext.mockClear()
    attachLeadIdToSessionSubmission.mockClear()
    findProfileForFormLeadGate.mockClear()
    tryClaimLeadIdentity.mockClear()
    upsertLeadFromFormAnswers.mockClear()

    findPublicationById.mockResolvedValue({
      publicationId: PUBLICATION_ID,
      version: 1,
      snapshot,
    })
    findLatestSessionSubmissionOnForm.mockResolvedValue({ id: "sub-1", leadId: null })
    listSubmissionAnswers.mockResolvedValue([])
    findProfileForFormLeadGate.mockResolvedValue(null)
    tryClaimLeadIdentity.mockResolvedValue(true)
    upsertLeadFromFormAnswers.mockResolvedValue(null)
  })

  it("não cria CRM enquanto o gate A+C está aberto", async () => {
    const output = await createCrmLeadFromRadarFormGateUseCase.execute({
      ...baseInput,
      questionId: NAME_ID,
      answerValue: "Maria Silva",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ skipped: "gate_open" })
    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
  })

  it("fecha A+C com respostas da sessão + evento novo e cria o lead", async () => {
    listSubmissionAnswers.mockResolvedValue([{ questionId: NAME_ID, value: "Maria Silva" }])
    upsertLeadFromFormAnswers.mockResolvedValue({
      lead: { id: "lead-new" },
      created: true,
    })

    const output = await createCrmLeadFromRadarFormGateUseCase.execute({
      ...baseInput,
      questionId: PHONE_ID,
      answerValue: "(11) 98888-7777",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ leadId: "lead-new", created: true })
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledTimes(1)
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ allowCreate: true }),
    )
    expect(attachLeadIdToSessionSubmission).toHaveBeenCalledWith(FORM_ID, "session-1", "lead-new")
    expect(tryClaimLeadIdentity).toHaveBeenCalledWith(
      "team-1",
      "profile-1",
      "lead-new",
      "public_form_radar_gate",
    )
  })

  it("fecha A+C com nome do perfil Radar unificado + telefone do evento", async () => {
    findProfileForFormLeadGate.mockResolvedValue({
      id: "profile-1",
      displayName: "Maria Silva",
      displayPhone: null,
      normalizedPhone: null,
      primaryEmail: null,
      identities: [],
    })
    upsertLeadFromFormAnswers.mockResolvedValue({
      lead: { id: "lead-from-profile" },
      created: true,
    })

    const output = await createCrmLeadFromRadarFormGateUseCase.execute({
      ...baseInput,
      questionId: PHONE_ID,
      answerValue: "(11) 98888-7777",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ leadId: "lead-from-profile", created: true })
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCreate: true,
        identityOverlay: expect.objectContaining({ displayName: "Maria Silva" }),
      }),
    )
  })

  it("não cria de novo quando o perfil já tem identidade lead_id", async () => {
    findProfileForFormLeadGate.mockResolvedValue({
      id: "profile-1",
      displayName: "Maria Silva",
      displayPhone: "(11) 98888-7777",
      normalizedPhone: "11988887777",
      primaryEmail: null,
      identities: [{ type: "lead_id", value: "lead-existing", normalizedValue: "lead-existing" }],
    })

    const output = await createCrmLeadFromRadarFormGateUseCase.execute({
      ...baseInput,
      questionId: PHONE_ID,
      answerValue: "(11) 98888-7777",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ skipped: "already_linked" })
    expect(upsertLeadFromFormAnswers).not.toHaveBeenCalled()
  })

  it("não cria de novo quando a sessão já tem leadId — só atualiza e reclama identidade", async () => {
    findLatestSessionSubmissionOnForm.mockResolvedValue({
      id: "sub-1",
      leadId: "lead-session",
    })
    listSubmissionAnswers.mockResolvedValue([
      { questionId: NAME_ID, value: "Maria Silva" },
      { questionId: PHONE_ID, value: "(11) 98888-7777" },
    ])
    upsertLeadFromFormAnswers.mockResolvedValue({
      lead: { id: "lead-session" },
      created: false,
    })

    const output = await createCrmLeadFromRadarFormGateUseCase.execute({
      ...baseInput,
      questionId: PHONE_ID,
      answerValue: "(11) 98888-1111",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ leadId: "lead-session", created: false })
    expect(upsertLeadFromFormAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ allowCreate: false }),
    )
    expect(tryClaimLeadIdentity).toHaveBeenCalledWith(
      "team-1",
      "profile-1",
      "lead-session",
      "public_form_radar_gate",
    )
  })
})
