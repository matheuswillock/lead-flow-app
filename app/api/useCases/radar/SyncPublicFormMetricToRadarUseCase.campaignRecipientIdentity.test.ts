import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import type {
  IRadarProfileMergeRepository,
  IRadarPublicFormProfileRepository,
} from "@/app/api/infra/data/repositories/radar/IRadarPublicFormProfileRepository"
import { SyncPublicFormMetricToRadarUseCase } from "./SyncPublicFormMetricToRadarUseCase"

/**
 * Adenda E6b (SPEC 10, decisão do owner 02/09) — caso real KKJ (perfil
 * `86426c89`): perfil nasceu "Visitante Anônimo" mesmo com o `cs_el` sabendo
 * o destinatário (`recipientEmail`/`recipientName` já chegavam no `origin`
 * via `ResolveEmailCampaignFormAttributionUseCase`, gap E6b). Regra: perfil
 * criado pelo fallback de recipientEmail (sem resposta nativa de nome/e-mail
 * nesta submissão) herda `displayName` do destinatário — com a mesma guarda
 * de divergência do #1107 — e a identidade digitada depois sempre substitui.
 */

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
const appendEventIfNewBySourceKey = mock(
  async (_input: unknown): Promise<{ id: string } | null> => ({ id: "event-1" }),
)
const leadSync = { execute: mock(async () => new Output(true, [], [], {})) }
const leadGate = { execute: mock(async () => new Output(true, [], [], { leadId: null })) }
const eligibility = {
  execute: mock(async () => new Output(true, [], [], { eligible: false, reason: "not_eligible" })),
}
const materializeAnswer = { execute: mock(async () => new Output(true, [], [], null)) }

const repository: IRadarPublicFormProfileRepository & IRadarProfileMergeRepository = {
  findProfileByIdentity,
  resolveProfileForVisitorSession,
  resolveProfileForEmail,
  resolveProfileForPhone,
  mergePublicFormProfiles,
  appendEventIfNewBySourceKey,
}

const baseInput = {
  teamId: "team-1",
  eventType: "form_viewed" as const,
  eventKey: "session-1:form_viewed:form",
  visitorSessionId: "session-1",
  formId: "form-1",
  publicationId: "publication-1",
}

function createUseCase() {
  return new SyncPublicFormMetricToRadarUseCase(
    repository,
    leadSync,
    leadGate,
    eligibility,
    materializeAnswer,
    () => "legacy",
  )
}

describe("SyncPublicFormMetricToRadarUseCase — herança de identidade do destinatário (E6b)", () => {
  beforeEach(() => {
    findProfileByIdentity.mockReset()
    findProfileByIdentity.mockImplementation(async () => null)
    resolveProfileForVisitorSession.mockReset()
    resolveProfileForVisitorSession.mockImplementation(async () => ({
      profile: { id: "visitor-profile" },
      wasExisting: true,
    }))
    resolveProfileForEmail.mockReset()
    resolveProfileForEmail.mockImplementation(async () => ({
      profile: { id: "email-profile" },
      wasExisting: true,
    }))
    resolveProfileForPhone.mockReset()
    appendEventIfNewBySourceKey.mockReset()
    appendEventIfNewBySourceKey.mockImplementation(async () => ({ id: "event-1" }))
    leadGate.execute.mockReset()
    leadGate.execute.mockImplementation(async () => new Output(true, [], [], { leadId: null }))
    eligibility.execute.mockReset()
    eligibility.execute.mockImplementation(
      async () => new Output(true, [], [], { eligible: false, reason: "not_eligible" }),
    )
    materializeAnswer.execute.mockReset()
    materializeAnswer.execute.mockImplementation(async () => new Output(true, [], [], null))
  })

  // T-R6b.1
  it("form_viewed com recipientEmail+recipientName conhecidos → perfil nasce com o nome do destinatário (não anônimo)", async () => {
    await createUseCase().execute({
      ...baseInput,
      origin: { recipientEmail: "marianalombardi@uol.com.br", recipientName: "Mariana Lombardi" },
    })

    expect(resolveProfileForEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEmail: "marianalombardi@uol.com.br",
        displayName: "Mariana Lombardi",
      }),
    )
    expect(resolveProfileForVisitorSession).not.toHaveBeenCalled()
  })

  // T-R6b.2
  it("resposta com e-mail solto DIVERGENTE do destinatário (encaminhamento) → não herda, permanece anônimo", async () => {
    await createUseCase().execute({
      ...baseInput,
      eventType: "question_answered",
      // Pergunta SEM mapping de e-mail (mappingKey null) — o respondente
      // digitou o próprio e-mail como texto solto, e ele diverge do
      // destinatário do disparo.
      answerMappingKey: null,
      answerValue: "outrapessoa@example.com",
      origin: { recipientEmail: "marianalombardi@uol.com.br", recipientName: "Mariana Lombardi" },
    })

    expect(resolveProfileForEmail).not.toHaveBeenCalled()
    expect(resolveProfileForVisitorSession).toHaveBeenCalledTimes(1)
  })

  // T-R6b.3
  it("identidade digitada depois (e-mail nativo) nunca herda o nome inferido do destinatário", async () => {
    await createUseCase().execute({
      ...baseInput,
      eventType: "question_answered",
      answerMappingKey: "email",
      answerValue: "visitante-real@example.com",
      origin: { recipientEmail: "marianalombardi@uol.com.br", recipientName: "Mariana Lombardi" },
    })

    expect(resolveProfileForEmail).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: "visitante-real@example.com", displayName: null }),
    )
  })

  it("sem recipientName (só recipientEmail) → herda mesmo assim, sem nome (comportamento anterior preservado)", async () => {
    await createUseCase().execute({
      ...baseInput,
      origin: { recipientEmail: "marianalombardi@uol.com.br" },
    })

    expect(resolveProfileForEmail).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: "marianalombardi@uol.com.br", displayName: null }),
    )
  })
})
