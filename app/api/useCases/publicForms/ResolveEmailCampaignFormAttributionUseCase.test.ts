import { beforeEach, describe, expect, it } from "bun:test"
import { FORM_START_ACTIVITY_BODY } from "@/lib/public-forms/email-campaign-attribution"
import {
  applyWebhookEventMock as applyWebhookEvent,
  createLeadActivityNoteMock as createLeadActivityNote,
  createLeadMock as createLead,
  findCampaignContactListIdsMock as findCampaignContactListIds,
  findCampaignLogForAttributionMock as findCampaignLogForAttribution,
  findCampaignWebhookRecordByIdMock as findCampaignWebhookRecordById,
  findEmailContactCustomFieldsMock as findEmailContactCustomFields,
  findFormSubmissionContextMock as findFormSubmissionContext,
  findLeadActivityByEmailLogAttributionMock as findLeadActivityByEmailLogAttribution,
  findLeadCandidatesMock as findLeadCandidates,
  findRadarPhoneByEmailMock as findRadarPhoneByEmail,
  registerPublicFormLeadSyncModuleMocks,
  syncLeadToRadarExecuteMock as syncLeadExecute,
  updateLeadMock as updateLead,
} from "@/test/support/public-form-lead-sync-module-mocks"

/**
 * Mocks de módulo COMPARTILHADOS (helper do #1144). Antes, este arquivo
 * registrava fábricas PRÓPRIAS e PARCIAIS para os mesmos módulos dos testes de
 * `publicFormLeadSync` — inclusive `mock.module` de `publicFormLeadSync` com
 * só `findMatchingLead`, que derrubava os vizinhos com
 * "upsertLeadFromFormAnswers is not a function" conforme a ordem interna do
 * runner (o Bun ignora a ordem da CLI). Agora o módulo `publicFormLeadSync` é
 * REAL — o `findMatchingLead` é dirigido pelo `findLeadCandidatesMock`
 * compartilhado, exercitando também o `pickBestLeadMatch` de produção.
 */
registerPublicFormLeadSyncModuleMocks()

const EMAIL_LOG_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const TEAM_ID = "team-1"
const FORM_ID = "form-1"

/** Lead retornável pelo `findLeadCandidatesMock` que casa por e-mail no `pickBestLeadMatch` real. */
function makeCandidateLead(id: string) {
  return {
    id,
    name: "Destinatário",
    email: "destinatario@exemplo.com",
    phone: null,
    notes: null,
    deletedAt: null,
  }
}

type WebhookRecord = {
  id: string
  teamId: string
  status: string
  recipientEmail: string
  recipientName: string | null
  campaignId: string | null
  dispatchId: string | null
  deliveredAt: Date | null
  openedAt: Date | null
  clickedAt: Date | null
  bouncedAt: Date | null
  complainedAt: Date | null
}

function makeWebhookRecord(overrides: Partial<WebhookRecord> = {}): WebhookRecord {
  return {
    id: EMAIL_LOG_ID,
    teamId: TEAM_ID,
    status: "delivered",
    recipientEmail: "destinatario@exemplo.com",
    recipientName: "Destinatário",
    campaignId: "campaign-1",
    dispatchId: "dispatch-1",
    deliveredAt: new Date("2026-08-20T10:00:00.000Z"),
    openedAt: null,
    clickedAt: null,
    bouncedAt: null,
    complainedAt: null,
    ...overrides,
  }
}

/** Deixa o fire-and-forget do clique first-party resolver antes das asserções. */
const flushPendingClick = () => new Promise((resolve) => setTimeout(resolve, 0))

const { resolveEmailCampaignFormAttributionUseCase } = await import(
  "@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase"
)

const baseInput = {
  teamId: TEAM_ID,
  formId: FORM_ID,
  formName: "Formulário Teste",
  formPublicId: "pub-form-1",
  publicationId: "publication-1",
  emailCampaignTrackingEnabled: true,
  origin: { emailLogId: EMAIL_LOG_ID },
  visitorSessionId: "vs-1",
} as const

describe("ResolveEmailCampaignFormAttributionUseCase (E1)", () => {
  beforeEach(() => {
    findCampaignLogForAttribution.mockReset()
    findFormSubmissionContext.mockReset()
    findLeadCandidates.mockReset()
    createLead.mockReset()
    updateLead.mockReset()
    createLeadActivityNote.mockReset()
    findLeadActivityByEmailLogAttribution.mockReset()
    syncLeadExecute.mockReset()
    findCampaignContactListIds.mockReset()
    findEmailContactCustomFields.mockReset()
    findRadarPhoneByEmail.mockReset()
    findCampaignWebhookRecordById.mockReset()
    applyWebhookEvent.mockReset()

    findCampaignWebhookRecordById.mockImplementation(async () => makeWebhookRecord())
    applyWebhookEvent.mockImplementation(async () => undefined)
    findCampaignLogForAttribution.mockImplementation(async () => ({
      id: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "destinatario@exemplo.com",
      recipientName: "Destinatário",
      campaignName: null,
    }))
    findFormSubmissionContext.mockImplementation(async () => ({
      id: FORM_ID,
      assignedSdrId: null,
      team: { master: { id: "master-1", supabaseId: "supabase-1" } },
    }))
    // `findMatchingLead` é o REAL — sem candidato, sem match.
    findLeadCandidates.mockImplementation(async () => [])
    createLead.mockImplementation(async () => ({
      isValid: true,
      successMessages: [],
      result: { id: "lead-created-1", email: "destinatario@exemplo.com" },
      errorMessages: [],
    }))
    updateLead.mockImplementation(async (id: string) => ({
      id,
      email: "destinatario@exemplo.com",
    }))
    findLeadActivityByEmailLogAttribution.mockImplementation(async () => null)
    createLeadActivityNote.mockImplementation(async () => ({ id: "activity-1" }))
    syncLeadExecute.mockImplementation(async () => ({ isValid: true }))
    findCampaignContactListIds.mockImplementation(async () => [])
    findEmailContactCustomFields.mockImplementation(async () => null)
    findRadarPhoneByEmail.mockImplementation(async () => null)
  })

  it("form_viewed com cs_el válido, sem lead existente → não cria Lead; enrichedOrigin.recipientEmail", async () => {
    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })

    expect(output.isValid).toBe(true)
    expect(findLeadCandidates).toHaveBeenCalledTimes(1)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: null,
      emailLogId: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      enrichedOrigin: expect.objectContaining({
        emailLogId: EMAIL_LOG_ID,
        recipientEmail: "destinatario@exemplo.com",
        recipientName: "Destinatário",
        campaignId: "campaign-1",
      }),
    })
  })

  // Gap E6b (02/09): `recipientName` nunca chegava ao `origin` — só
  // `recipientEmail` era enriquecido, deixando o perfil Radar sem como herdar
  // o nome do destinatário (caso KKJ, perfil `86426c89`).
  it("recipientName ausente no EmailLog → enrichedOrigin não tem a chave (nunca string vazia)", async () => {
    findCampaignLogForAttribution.mockImplementation(async () => ({
      id: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "destinatario@exemplo.com",
      recipientName: null,
      campaignName: null,
    }))

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })

    const result = output.result as { enrichedOrigin: Record<string, unknown> }
    expect(result.enrichedOrigin.recipientName).toBeUndefined()
  })

  it("form_viewed atribuído → grava EmailEvent clicked (repõe a métrica sem redirecionador)", async () => {
    await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      occurredAt: "2026-08-22T13:45:00.000Z",
    })
    await flushPendingClick()

    expect(applyWebhookEvent).toHaveBeenCalledTimes(1)
    const [call] = applyWebhookEvent.mock.calls[0] as [
      { eventType: string; occurredAt: Date; metadata: Record<string, unknown>; log: WebhookRecord },
    ]
    expect(call.eventType).toBe("clicked")
    expect(call.occurredAt).toEqual(new Date("2026-08-22T13:45:00.000Z"))
    expect(call.log.id).toBe(EMAIL_LOG_ID)
    expect(call.metadata).toMatchObject({
      source: "public_form_attribution",
      formPublicId: "pub-form-1",
    })
  })

  it("form_viewed repetido (clickedAt já gravado) → não conta clique de novo", async () => {
    findCampaignWebhookRecordById.mockImplementation(async () =>
      makeWebhookRecord({ clickedAt: new Date("2026-08-22T13:45:00.000Z"), status: "clicked" })
    )

    await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })
    await flushPendingClick()

    expect(applyWebhookEvent).not.toHaveBeenCalled()
  })

  it("form_started / form_completed não geram clique — só form_viewed é o proxy do clique", async () => {
    for (const eventType of ["form_started", "form_completed"] as const) {
      await resolveEmailCampaignFormAttributionUseCase.execute({ ...baseInput, eventType })
    }
    await flushPendingClick()

    expect(applyWebhookEvent).not.toHaveBeenCalled()
  })

  it("form_completed após form_viewed (mesmo emailLogId) → não cria Lead na atribuição", async () => {
    findRadarPhoneByEmail.mockImplementation(async () => "11999998888")

    const viewed = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })
    expect(viewed.result).toMatchObject({ leadId: null })
    expect(createLead).not.toHaveBeenCalled()

    const completed = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
    })

    expect(completed.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(completed.result).toMatchObject({
      leadId: null,
      emailLogId: EMAIL_LOG_ID,
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
        emailLogId: EMAIL_LOG_ID,
      }),
    })
  })

  it("form_started com telefone na lista e sem lead existente → não cria Lead", async () => {
    findRadarPhoneByEmail.mockImplementation(async () => "1138971122")

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_started",
    })

    expect(output.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(createLeadActivityNote).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ leadId: null })
  })

  it("form_completed sem telefone válido → não cria Lead (regra nome+telefone)", async () => {
    findRadarPhoneByEmail.mockImplementation(async () => null)

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
    })

    expect(output.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: null,
      emailLogId: EMAIL_LOG_ID,
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
      }),
    })
  })

  it("form_completed sem nome válido → não cria Lead", async () => {
    findRadarPhoneByEmail.mockImplementation(async () => "11999998888")
    findCampaignLogForAttribution.mockImplementation(async () => ({
      id: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "x@exemplo.com",
      recipientName: " ",
      campaignName: null,
    }))

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
    })

    // resolveAttributionDisplayName cai no local-part do e-mail ("x") — 1 char < 2
    expect(output.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ leadId: null })
  })

  it("form_viewed quando já existe lead real (mesmo e-mail) → encontra/atualiza, não cria", async () => {
    findLeadCandidates.mockImplementation(async () => [makeCandidateLead("lead-existing-1")])

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })

    expect(output.isValid).toBe(true)
    expect(findLeadCandidates).toHaveBeenCalledTimes(1)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: "lead-existing-1",
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
      }),
    })
  })

  it("form_started com lead existente → anexa atividade de início; sem criar Lead", async () => {
    findLeadCandidates.mockImplementation(async () => [makeCandidateLead("lead-existing-2")])

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_started",
    })

    expect(output.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(createLeadActivityNote).toHaveBeenCalledTimes(1)
    const activityArg = (
      createLeadActivityNote.mock.calls as unknown as Array<[{ leadId: string; body: string }]>
    )[0]?.[0]
    expect(activityArg).toMatchObject({
      leadId: "lead-existing-2",
      body: FORM_START_ACTIVITY_BODY,
    })
    expect(output.result).toMatchObject({ leadId: "lead-existing-2" })
  })

  it("form_started sem lead existente → não cria Lead nem atividade", async () => {
    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_started",
    })

    expect(output.isValid).toBe(true)
    expect(createLead).not.toHaveBeenCalled()
    expect(createLeadActivityNote).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: null,
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
      }),
    })
  })
})
