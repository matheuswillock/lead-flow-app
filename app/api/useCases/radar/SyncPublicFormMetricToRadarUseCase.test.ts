import { beforeEach, describe, expect, it, mock } from "bun:test"

type AppendArg = {
  profileId: string
  eventType: string
  sourceType: string
  sourceId: string
}

const findProfileByIdentity = mock(
  async (_teamId: string, _type: string, _value: string): Promise<{ profileId: string } | null> =>
    null
)
const resolveProfileForVisitorSession = mock(
  async (_input: {
    teamId: string
    visitorSession: string
    lastSeenAt?: Date
  }): Promise<{ profile: { id: string }; wasExisting: boolean }> => ({
    profile: { id: "anon-profile-1" },
    wasExisting: false,
  })
)
const resolveProfileForEmail = mock(
  async (_input: {
    teamId: string
    normalizedEmail: string
    emailValue: string
    displayName: string | null
    normalizedName: string | null
    emailSource: string
    lastSeenAt?: Date
  }): Promise<{ profile: { id: string }; wasExisting: boolean }> => ({
    profile: { id: "email-profile-1" },
    wasExisting: false,
  })
)
const appendEventIfNewBySourceKey = mock(
  async (_input: AppendArg): Promise<{ id: string } | null> => ({ id: "event-1" })
)
const syncLeadExecute = mock(async (_input: { leadId: string; teamId: string }) => ({
  isValid: true,
}))

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    findProfileByIdentity,
    resolveProfileForVisitorSession,
    resolveProfileForEmail,
    appendEventIfNewBySourceKey,
  },
}))

mock.module("@/app/api/useCases/radar/SyncLeadToRadarUseCase", () => ({
  syncLeadToRadarUseCase: {
    execute: syncLeadExecute,
  },
}))

mock.module("@/lib/radar/team-has-radar-feature", () => ({
  teamHasRadarFeature: mock(async () => true),
}))

const { syncPublicFormMetricToRadarUseCase } = await import(
  "@/app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase"
)
const { mapPublicFormMetricToRadarEventType, PUBLIC_FORM_RADAR_SOURCE_TYPE } = await import(
  "@/lib/radar/map-public-form-metric-to-radar-event"
)

const baseInput = {
  teamId: "team-1",
  visitorSessionId: "vs-abc",
  formId: "form-1",
  publicationId: "pub-1",
  eventKey: "vs-abc:form_viewed:form",
}

function lastAppendArg(): AppendArg {
  const calls = appendEventIfNewBySourceKey.mock.calls as unknown as Array<[AppendArg]>
  const arg = calls[calls.length - 1]?.[0]
  if (!arg) throw new Error("appendEventIfNewBySourceKey não foi chamado")
  return arg
}

describe("mapPublicFormMetricToRadarEventType", () => {
  it("mapeia todos os PublicFormMetricType para prefixo form.", () => {
    expect(mapPublicFormMetricToRadarEventType("form_viewed")).toBe("form.viewed")
    expect(mapPublicFormMetricToRadarEventType("form_started")).toBe("form.started")
    expect(mapPublicFormMetricToRadarEventType("question_viewed")).toBe("form.question_viewed")
    expect(mapPublicFormMetricToRadarEventType("question_answered")).toBe("form.question_answered")
    expect(mapPublicFormMetricToRadarEventType("question_skipped")).toBe("form.question_skipped")
    expect(mapPublicFormMetricToRadarEventType("form_completed")).toBe("form.completed")
    expect(mapPublicFormMetricToRadarEventType("lead_created")).toBe("form.lead_created")
    expect(mapPublicFormMetricToRadarEventType("lead_attached")).toBe("form.lead_attached")
    expect(mapPublicFormMetricToRadarEventType("meeting_scheduled")).toBe("form.meeting_scheduled")
  })
})

describe("SyncPublicFormMetricToRadarUseCase (D8)", () => {
  beforeEach(() => {
    findProfileByIdentity.mockReset()
    resolveProfileForVisitorSession.mockReset()
    resolveProfileForEmail.mockReset()
    appendEventIfNewBySourceKey.mockReset()
    syncLeadExecute.mockReset()

    findProfileByIdentity.mockImplementation(async () => null)
    resolveProfileForVisitorSession.mockImplementation(async () => ({
      profile: { id: "anon-profile-1" },
      wasExisting: false,
    }))
    resolveProfileForEmail.mockImplementation(async () => ({
      profile: { id: "email-profile-1" },
      wasExisting: false,
    }))
    appendEventIfNewBySourceKey.mockImplementation(async () => ({ id: "event-1" }))
    syncLeadExecute.mockImplementation(async () => ({ isValid: true }))
  })

  it.each([
    "form_viewed",
    "form_started",
    "question_viewed",
    "question_answered",
    "question_skipped",
  ] as const)("evento pré-lead %s → perfil anônimo visitor_session (sem pixel)", async (eventType) => {
    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType,
      eventKey: `vs-abc:${eventType}:form`,
    })

    expect(output.isValid).toBe(true)
    expect(resolveProfileForVisitorSession).toHaveBeenCalledTimes(1)
    expect(findProfileByIdentity).not.toHaveBeenCalled()
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledTimes(1)

    const appendArg = lastAppendArg()
    const expectedType = mapPublicFormMetricToRadarEventType(eventType)
    if (expectedType === null) {
      throw new Error(`mapeamento ausente para ${eventType}`)
    }
    expect(appendArg.profileId).toBe("anon-profile-1")
    expect(appendArg.eventType).toBe(expectedType)
    expect(appendArg.sourceType).toBe(PUBLIC_FORM_RADAR_SOURCE_TYPE)
    expect(appendArg.sourceId).toBe(`vs-abc:${eventType}:form`)
  })

  it("form_viewed com recipientEmail (campanha) → perfil por e-mail", async () => {
    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "vs-abc:form_viewed:form",
      origin: { recipientEmail: "lead@campanha.com", emailLogId: "log-1" },
    })

    expect(output.isValid).toBe(true)
    expect(resolveProfileForEmail).toHaveBeenCalledTimes(1)
    expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()
    expect(lastAppendArg().profileId).toBe("email-profile-1")
  })

  it("form_viewed com leadId (atribuição e-mail) → identidade lead_id", async () => {
    findProfileByIdentity.mockImplementation(async () => ({ profileId: "lead-profile-attr" }))

    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "vs-abc:form_viewed:form",
      leadId: "lead-attr-1",
    })

    expect(output.isValid).toBe(true)
    expect(findProfileByIdentity).toHaveBeenCalledWith("team-1", "lead_id", "lead-attr-1")
    expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()
    expect(lastAppendArg().profileId).toBe("lead-profile-attr")
  })

  it.each(["form_completed", "lead_created", "lead_attached"] as const)(
    "evento com leadId %s → identidade lead_id",
    async (eventType) => {
      findProfileByIdentity.mockImplementation(async () => ({ profileId: "lead-profile-1" }))

      const output = await syncPublicFormMetricToRadarUseCase.execute({
        ...baseInput,
        eventType,
        eventKey: `req-1:${eventType}`,
        leadId: "lead-1",
      })

      expect(output.isValid).toBe(true)
      expect(findProfileByIdentity).toHaveBeenCalledWith("team-1", "lead_id", "lead-1")
      expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()

      const appendArg = lastAppendArg()
      const expectedType = mapPublicFormMetricToRadarEventType(eventType)
      if (expectedType === null) {
        throw new Error(`mapeamento ausente para ${eventType}`)
      }
      expect(appendArg.profileId).toBe("lead-profile-1")
      expect(appendArg.eventType).toBe(expectedType)
      expect(appendArg.sourceId).toBe(`req-1:${eventType}`)
    }
  )

  it("form_completed com leadId sem perfil: sync lead e então anexa", async () => {
    findProfileByIdentity
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({ profileId: "lead-profile-2" }))

    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
      eventKey: "req-1:form_completed",
      leadId: "lead-2",
    })

    expect(output.isValid).toBe(true)
    expect(syncLeadExecute).toHaveBeenCalledWith({ leadId: "lead-2", teamId: "team-1" })
    expect(lastAppendArg()).toMatchObject({
      profileId: "lead-profile-2",
      eventType: "form.completed",
    })
  })

  it("form_completed sem leadId → perfil anônimo", async () => {
    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
      eventKey: "req-1:form_completed",
    })

    expect(output.isValid).toBe(true)
    expect(resolveProfileForVisitorSession).toHaveBeenCalledTimes(1)
    expect(findProfileByIdentity).not.toHaveBeenCalled()
  })

  it("dedupe: segunda chamada com mesmo eventKey não cria evento novo", async () => {
    appendEventIfNewBySourceKey
      .mockImplementationOnce(async () => ({ id: "event-1" }))
      .mockImplementationOnce(async () => null)

    const first = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "same-key",
    })
    const second = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "same-key",
    })

    expect(first.result).toMatchObject({ created: true })
    expect(second.result).toMatchObject({ created: false })
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledTimes(2)
    const calls = appendEventIfNewBySourceKey.mock.calls as unknown as Array<[AppendArg]>
    expect(calls[0]?.[0]).toMatchObject({ sourceId: "same-key" })
    expect(calls[1]?.[0]).toMatchObject({ sourceId: "same-key" })
  })

  it("cria perfil anônimo mesmo sem pixel prévio", async () => {
    resolveProfileForVisitorSession.mockImplementation(async () => ({
      profile: { id: "fresh-anon" },
      wasExisting: false,
    }))

    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "vs-new:form_viewed:form",
      visitorSessionId: "vs-new",
    })

    expect(output.isValid).toBe(true)
    expect(resolveProfileForVisitorSession).toHaveBeenCalledWith({
      teamId: "team-1",
      visitorSession: "vs-new",
      lastSeenAt: expect.any(Date),
    })
    expect(output.result).toMatchObject({ profileId: "fresh-anon", created: true })
  })

  it("E1: form_viewed sem leadId com recipientEmail → resolveProfileForEmail (não sessão anônima)", async () => {
    const output = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "vs-abc:form_viewed:form",
      leadId: null,
      origin: {
        emailLogId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        recipientEmail: "destinatario@exemplo.com",
      },
    })

    expect(output.isValid).toBe(true)
    expect(resolveProfileForEmail).toHaveBeenCalledWith({
      teamId: "team-1",
      normalizedEmail: "destinatario@exemplo.com",
      emailValue: "destinatario@exemplo.com",
      displayName: null,
      normalizedName: null,
      emailSource: "email_log",
      lastSeenAt: expect.any(Date),
    })
    expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()
    expect(findProfileByIdentity).not.toHaveBeenCalled()
    expect(lastAppendArg().profileId).toBe("email-profile-1")
  })

  it("E1: form_viewed e form_completed com mesmo recipientEmail → mesmo perfil Radar", async () => {
    resolveProfileForEmail.mockImplementation(async () => ({
      profile: { id: "shared-email-profile" },
      wasExisting: true,
    }))

    const viewed = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_viewed",
      eventKey: "vs-abc:form_viewed:form",
      origin: { recipientEmail: "mesmo@exemplo.com" },
    })
    const completed = await syncPublicFormMetricToRadarUseCase.execute({
      ...baseInput,
      eventType: "form_completed",
      eventKey: "vs-abc:form_completed:form",
      origin: { recipientEmail: "mesmo@exemplo.com" },
    })

    expect(viewed.result).toMatchObject({ profileId: "shared-email-profile" })
    expect(completed.result).toMatchObject({ profileId: "shared-email-profile" })
    expect(resolveProfileForEmail).toHaveBeenCalledTimes(2)
    expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()
  })
})
