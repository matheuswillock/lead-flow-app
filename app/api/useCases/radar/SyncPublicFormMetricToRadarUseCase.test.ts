import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import type {
  IRadarProfileMergeRepository,
  IRadarPublicFormProfileRepository,
} from "@/app/api/infra/data/repositories/radar/IRadarPublicFormProfileRepository"
import { SyncPublicFormMetricToRadarUseCase } from "./SyncPublicFormMetricToRadarUseCase"

const findProfileByIdentity = mock(
  async (_teamId: string, _type: string, _value: string) => null as { profileId: string } | null,
)
const resolveProfileForVisitorSession = mock(async () => ({
  profile: { id: "visitor-profile" },
  wasExisting: true,
}))
const resolveProfileForEmail = mock(async () => ({
  profile: { id: "email-profile" },
  wasExisting: true,
}))
const resolveProfileForPhone = mock(async () => ({
  profile: { id: "phone-profile" },
  wasExisting: true,
}))
const mergePublicFormProfiles = mock(async () => ({
  winningProfileId: "phone-profile",
  merged: true,
  conflict: false,
}))
const applyFormAnswerDisplayName = mock(async () => {})
const appendEventIfNewBySourceKey = mock(
  async (_input: unknown): Promise<{ id: string } | null> => ({ id: "event-1" }),
)
const leadSync = { execute: mock(async () => new Output(true, [], [], {})) }
const leadGate = {
  execute: mock(async () => new Output(true, [], [], { leadId: "lead-1", created: true })),
}
const eligibility = {
  execute: mock(async () => new Output(true, [], [], { eligible: true, reason: "eligible" })),
}

const repository: IRadarPublicFormProfileRepository & IRadarProfileMergeRepository = {
  findProfileByIdentity,
  resolveProfileForVisitorSession,
  resolveProfileForEmail,
  resolveProfileForPhone,
  mergePublicFormProfiles,
  applyFormAnswerDisplayName,
  appendEventIfNewBySourceKey,
}

const baseInput = {
  teamId: "team-1",
  eventType: "form_viewed",
  eventKey: "session-1:form_viewed:form",
  visitorSessionId: "session-1",
  formId: "form-1",
  publicationId: "publication-1",
}

function createUseCase(mode: "legacy" | "shadow" | "radar") {
  return new SyncPublicFormMetricToRadarUseCase(
    repository,
    leadSync,
    leadGate,
    eligibility,
    () => mode,
  )
}

describe("SyncPublicFormMetricToRadarUseCase", () => {
  beforeEach(() => {
    findProfileByIdentity.mockReset()
    resolveProfileForVisitorSession.mockReset()
    resolveProfileForEmail.mockReset()
    resolveProfileForPhone.mockReset()
    mergePublicFormProfiles.mockReset()
    applyFormAnswerDisplayName.mockReset()
    appendEventIfNewBySourceKey.mockReset()
    leadSync.execute.mockReset()
    leadGate.execute.mockReset()
    eligibility.execute.mockReset()

    findProfileByIdentity.mockImplementation(async () => null)
    resolveProfileForVisitorSession.mockImplementation(async () => ({
      profile: { id: "visitor-profile" },
      wasExisting: true,
    }))
    resolveProfileForEmail.mockImplementation(async () => ({
      profile: { id: "email-profile" },
      wasExisting: true,
    }))
    resolveProfileForPhone.mockImplementation(async () => ({
      profile: { id: "phone-profile" },
      wasExisting: true,
    }))
    mergePublicFormProfiles.mockImplementation(async () => ({
      winningProfileId: "phone-profile",
      merged: true,
      conflict: false,
    }))
    applyFormAnswerDisplayName.mockImplementation(async () => {})
    appendEventIfNewBySourceKey.mockImplementation(async () => ({ id: "event-1" }))
    leadSync.execute.mockImplementation(async () => new Output(true, [], [], {}))
    leadGate.execute.mockImplementation(
      async () => new Output(true, [], [], { leadId: "lead-1", created: true }),
    )
    eligibility.execute.mockImplementation(
      async () => new Output(true, [], [], { eligible: true, reason: "eligible" }),
    )
  })

  it("ingere fatos no Radar para qualquer time sem consultar add-on", async () => {
    const output = await createUseCase("legacy").execute(baseInput)

    expect(output.isValid).toBe(true)
    expect(resolveProfileForVisitorSession).toHaveBeenCalledTimes(1)
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledTimes(1)
  })

  it("preserva valor JSON tipado no evento Radar", async () => {
    await createUseCase("legacy").execute({
      ...baseInput,
      eventType: "question_answered",
      eventKey: "session-1:question_answered:q1",
      questionId: "q1",
      answerValue: ["individual", "familiar"],
    })

    expect(appendEventIfNewBySourceKey).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ answerValue: ["individual", "familiar"] }),
      }),
    )
  })

  it("materializa nome antes de executar o gate no modo radar", async () => {
    const output = await createUseCase("radar").execute({
      ...baseInput,
      eventType: "question_answered",
      eventKey: "session-1:question_answered:name:revision-1",
      questionId: "name",
      answerMappingKey: "name",
      answerValue: "Maria",
      leadGateRequest: "identity_revision",
    })

    expect(applyFormAnswerDisplayName).toHaveBeenCalledWith("visitor-profile", "team-1", "Maria")
    expect(leadGate.execute).toHaveBeenCalledWith({
      teamId: "team-1",
      formId: "form-1",
      visitorSessionId: "session-1",
      radarProfileId: "visitor-profile",
      eventId: "session-1:question_answered:name:revision-1",
      origin: {},
    })
    expect(output.result).toMatchObject({ leadId: "lead-1" })
  })

  it("modo legacy não executa o gate Radar", async () => {
    await createUseCase("legacy").execute({
      ...baseInput,
      eventType: "question_answered",
      leadGateRequest: "identity_revision",
    })

    expect(leadGate.execute).not.toHaveBeenCalled()
    expect(eligibility.execute).not.toHaveBeenCalled()
  })

  it("modo shadow calcula elegibilidade sem mutar CRM", async () => {
    await createUseCase("shadow").execute({
      ...baseInput,
      eventType: "question_answered",
      leadGateRequest: "identity_revision",
    })

    expect(eligibility.execute).toHaveBeenCalledTimes(1)
    expect(leadGate.execute).not.toHaveBeenCalled()
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "radar.crm_lead_gate_shadow",
        sourceId: `${baseInput.eventKey}:shadow`,
      }),
    )
  })

  it("reexecuta o gate para revisão corrigida mesmo quando o evento já existia", async () => {
    appendEventIfNewBySourceKey.mockImplementation(async () => null)

    await createUseCase("radar").execute({
      ...baseInput,
      eventType: "question_answered",
      leadGateRequest: "identity_revision",
      answerMappingKey: "phone",
      answerValue: "(11) 98888-7777",
    })

    expect(leadGate.execute).toHaveBeenCalledTimes(1)
  })

  it("propaga o perfil vencedor após unir sessão anônima e telefone", async () => {
    findProfileByIdentity.mockImplementation(async (_team: string, type: string) =>
      type === "visitor_session" ? { profileId: "visitor-profile" } : null,
    )
    mergePublicFormProfiles.mockImplementation(async () => ({
      winningProfileId: "visitor-profile",
      merged: true,
      conflict: false,
    }))

    const output = await createUseCase("legacy").execute({
      ...baseInput,
      eventType: "question_answered",
      answerMappingKey: "phone",
      answerValue: "(11) 98888-7777",
    })

    expect(output.result).toMatchObject({ profileId: "visitor-profile" })
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "visitor-profile" }),
    )
  })

  it("materializa o telefone respondido mesmo quando a campanha já fornece e-mail", async () => {
    await createUseCase("radar").execute({
      ...baseInput,
      eventType: "question_answered",
      answerMappingKey: "phone",
      answerValue: "(11) 98888-7777",
      origin: { recipientEmail: "maria@gmail.com" },
      leadGateRequest: "identity_revision",
    })

    expect(resolveProfileForPhone).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedPhone: "5511988887777",
        primaryEmail: "maria@gmail.com",
        normalizedPrimaryEmail: "maria@gmail.com",
      }),
    )
    expect(resolveProfileForEmail).not.toHaveBeenCalled()
    expect(leadGate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ radarProfileId: "phone-profile" }),
    )
  })

  it("transforma Output técnico inválido do sync de Lead em falha retryable", async () => {
    findProfileByIdentity.mockImplementation(async () => null)
    leadSync.execute.mockImplementation(
      async () => new Output(false, [], ["Radar temporariamente indisponível"], null),
    )

    const output = await createUseCase("legacy").execute({ ...baseInput, leadId: "lead-1" })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Radar temporariamente indisponível")
  })
})
