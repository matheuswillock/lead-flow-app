import { beforeEach, describe, expect, it, mock } from "bun:test"
import { FORM_START_ACTIVITY_BODY } from "@/lib/public-forms/email-campaign-attribution"

const EMAIL_LOG_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const TEAM_ID = "team-1"
const FORM_ID = "form-1"

const findCampaignLogForAttribution = mock(
  async (_teamId: string, _emailLogId: string) =>
    ({
      id: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "destinatario@exemplo.com",
      recipientName: "Destinatário",
      campaignName: "Alto Padrão · Form 1 · Dia 1",
    }) as {
      id: string
      campaignId: string | null
      dispatchId: string | null
      recipientEmail: string
      recipientName: string | null
      campaignName: string | null
    } | null
)

const findFormSubmissionContext = mock(async (_formId: string) => ({
  id: FORM_ID,
  assignedSdrId: null as string | null,
  team: {
    master: { id: "master-1", supabaseId: "supabase-1" },
  },
}))

const findCampaignContactListIds = mock(async () => [] as string[])
const findEmailContactCustomFields = mock(async () => null)
const findRadarPhoneByEmail = mock(async () => null as string | null)
const updateLead = mock(async (id: string, _data: unknown) => ({ id, email: "destinatario@exemplo.com" }))
const findLeadActivityByEmailLogAttribution = mock(async () => null)
const createLeadActivityNote = mock(async () => ({ id: "activity-1" }))

const findMatchingLead = mock(
  async (_teamId: string, _data: unknown): Promise<{ id: string; email: string | null; phone: string | null } | null> =>
    null
)

const createLead = mock(
  async (..._args: unknown[]) => ({
    isValid: true,
    result: { id: "lead-created-1", email: "destinatario@exemplo.com" },
    errorMessages: [] as string[],
  })
)

const syncLeadExecute = mock(async () => ({ isValid: true }))

mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: {
    findCampaignLogForAttribution,
  },
}))

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findFormSubmissionContext,
    findCampaignContactListIds,
    findEmailContactCustomFields,
    findRadarPhoneByEmail,
    updateLead,
    findLeadActivityByEmailLogAttribution,
    createLeadActivityNote,
  },
}))

mock.module("@/app/api/useCases/publicForms/publicFormLeadSync", () => ({
  findMatchingLead,
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

mock.module("@/app/api/useCases/radar/SyncLeadToRadarUseCase", () => ({
  syncLeadToRadarUseCase: {
    execute: syncLeadExecute,
  },
}))

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
    findMatchingLead.mockReset()
    createLead.mockReset()
    updateLead.mockReset()
    createLeadActivityNote.mockReset()
    findLeadActivityByEmailLogAttribution.mockReset()
    syncLeadExecute.mockReset()
    findCampaignContactListIds.mockReset()
    findEmailContactCustomFields.mockReset()
    findRadarPhoneByEmail.mockReset()

    findCampaignLogForAttribution.mockImplementation(async () => ({
      id: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "destinatario@exemplo.com",
      recipientName: "Destinatário",
      campaignName: "Alto Padrão · Form 1 · Dia 1",
    }))
    findFormSubmissionContext.mockImplementation(async () => ({
      id: FORM_ID,
      assignedSdrId: null,
      team: { master: { id: "master-1", supabaseId: "supabase-1" } },
    }))
    findMatchingLead.mockImplementation(async () => null)
    createLead.mockImplementation(async () => ({
      isValid: true,
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
    expect(findMatchingLead).toHaveBeenCalledTimes(1)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: null,
      emailLogId: EMAIL_LOG_ID,
      campaignId: "campaign-1",
      enrichedOrigin: expect.objectContaining({
        emailLogId: EMAIL_LOG_ID,
        recipientEmail: "destinatario@exemplo.com",
        campaignId: "campaign-1",
      }),
    })
  })

  it("form_completed após form_viewed (mesmo emailLogId) → cria Lead e mantém recipientEmail", async () => {
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
    expect(createLead).toHaveBeenCalledTimes(1)
    const createArgs = createLead.mock.calls[0] as unknown as [
      string,
      { name: string; phone: string },
      string,
      { body: string; payload: { campaignName?: string | null } },
    ]
    expect(createArgs[1]).toMatchObject({
      name: "Destinatário",
      phone: "11999998888",
    })
    expect(createArgs[3]).toMatchObject({
      body: "Lead criado via atribuição de campanha de e-mail [Alto Padrão · Form 1 · Dia 1]",
      payload: expect.objectContaining({ campaignName: "Alto Padrão · Form 1 · Dia 1" }),
    })
    expect(completed.result).toMatchObject({
      leadId: "lead-created-1",
      emailLogId: EMAIL_LOG_ID,
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
        emailLogId: EMAIL_LOG_ID,
      }),
    })
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
      campaignName: "Alto Padrão · Form 1 · Dia 1",
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
    findMatchingLead.mockImplementation(async () => ({
      id: "lead-existing-1",
      email: "destinatario@exemplo.com",
      phone: null,
    }))

    const output = await resolveEmailCampaignFormAttributionUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
    })

    expect(output.isValid).toBe(true)
    expect(findMatchingLead).toHaveBeenCalledTimes(1)
    expect(createLead).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      leadId: "lead-existing-1",
      enrichedOrigin: expect.objectContaining({
        recipientEmail: "destinatario@exemplo.com",
      }),
    })
  })

  it("form_started com lead existente → anexa atividade de início; sem criar Lead", async () => {
    findMatchingLead.mockImplementation(async () => ({
      id: "lead-existing-2",
      email: "destinatario@exemplo.com",
      phone: null,
    }))

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
