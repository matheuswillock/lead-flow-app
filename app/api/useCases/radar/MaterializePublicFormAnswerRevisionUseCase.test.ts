import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { MaterializePublicFormAnswerResult } from "@/app/api/infra/data/repositories/radar/IRadarPublicFormMaterializationRepository"
import { MaterializePublicFormAnswerRevisionUseCase } from "./MaterializePublicFormAnswerRevisionUseCase"

const materializePublicFormAnswer = mock(
  async (): Promise<MaterializePublicFormAnswerResult> => ({
    outcome: "applied",
    identityChanged: null,
    emailChange: null,
  }),
)
const reconcileAnsweredEmail = mock(async () => ({
  winningProfileId: "profile-1",
  merged: false,
  conflict: false,
}))
const appendEventIfNewBySourceKey = mock(
  async (_input: unknown): Promise<{ id: string } | null> => ({ id: "event-1" }),
)

const repository = {
  materializePublicFormAnswer,
  reconcileAnsweredEmail,
  appendEventIfNewBySourceKey,
}

const EVENT_ID = "0ef8dd3a-8a61-4bd4-9ef3-682d3c144254"

const baseInput = {
  teamId: "team-1",
  profileId: "profile-1",
  formId: "form-1",
  publicationId: "publication-1",
  questionId: "q-1",
  questionType: "short_text",
  mappingKey: "name",
  value: "Ana",
  eventId: EVENT_ID,
  occurredAt: new Date("2026-08-21T10:05:00.000Z"),
  campaignId: "campaign-1",
}

describe("MaterializePublicFormAnswerRevisionUseCase", () => {
  beforeEach(() => {
    materializePublicFormAnswer.mockReset()
    reconcileAnsweredEmail.mockReset()
    appendEventIfNewBySourceKey.mockReset()
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "applied",
      identityChanged: null,
      emailChange: null,
    }))
    reconcileAnsweredEmail.mockImplementation(async () => ({
      winningProfileId: "profile-1",
      merged: false,
      conflict: false,
    }))
    appendEventIfNewBySourceKey.mockImplementation(async () => ({ id: "event-1" }))
  })

  it("registra RadarEvent append-only com o contexto causal da revisão", async () => {
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    const output = await useCase.execute(baseInput)

    expect(output.isValid).toBe(true)
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledWith({
      profileId: "profile-1",
      teamId: "team-1",
      eventType: "public_form.answer_revision",
      sourceType: "public_form",
      sourceId: `${EVENT_ID}:q-1`,
      occurredAt: baseInput.occurredAt,
      metadata: {
        formId: "form-1",
        publicationId: "publication-1",
        questionId: "q-1",
        questionType: "short_text",
        mappingKey: "name",
        value: "Ana",
        eventId: EVENT_ID,
        campaignId: "campaign-1",
      },
    })
  })

  it("propaga a decisão de identidade da materialização", async () => {
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "applied",
      identityChanged: "name",
      emailChange: null,
    }))
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    const output = await useCase.execute(baseInput)

    expect(output.result).toEqual({
      profileId: "profile-1",
      outcome: "applied",
      identityChanged: "name",
    })
    expect(reconcileAnsweredEmail).not.toHaveBeenCalled()
  })

  it("revisão atrasada materializa como stale e não reconcilia identidade", async () => {
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "stale",
      identityChanged: null,
      emailChange: null,
    }))
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    const output = await useCase.execute(baseInput)

    expect(output.result).toMatchObject({ outcome: "stale", identityChanged: null })
    expect(reconcileAnsweredEmail).not.toHaveBeenCalled()
    // O histórico append-only continua sendo gravado mesmo para o evento atrasado.
    expect(appendEventIfNewBySourceKey).toHaveBeenCalledTimes(1)
  })

  it("e-mail respondido reconcilia e gera exatamente um profile.email_changed", async () => {
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "applied",
      identityChanged: "email",
      emailChange: {
        previousNormalizedEmail: "campanha@gmail.com",
        nextEmail: "Ana@Gmail.com",
        nextNormalizedEmail: "ana@gmail.com",
      },
    }))
    reconcileAnsweredEmail.mockImplementation(async () => ({
      winningProfileId: "profile-owner",
      merged: true,
      conflict: false,
    }))
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    const output = await useCase.execute({ ...baseInput, mappingKey: "email" })

    expect(reconcileAnsweredEmail).toHaveBeenCalledWith({
      teamId: "team-1",
      profileId: "profile-1",
      email: "Ana@Gmail.com",
      normalizedEmail: "ana@gmail.com",
      occurredAt: baseInput.occurredAt,
    })
    const emailChangedCalls = appendEventIfNewBySourceKey.mock.calls.filter(
      (call) => (call[0] as { eventType: string }).eventType === "profile.email_changed",
    )
    expect(emailChangedCalls).toHaveLength(1)
    expect(emailChangedCalls[0][0]).toMatchObject({
      profileId: "profile-owner",
      sourceId: `${EVENT_ID}:email_changed`,
    })
    expect(output.result).toMatchObject({ profileId: "profile-owner" })
  })

  it("não vaza PII no evento de troca de e-mail", async () => {
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "applied",
      identityChanged: "email",
      emailChange: {
        previousNormalizedEmail: "campanha@gmail.com",
        nextEmail: "Ana@Gmail.com",
        nextNormalizedEmail: "ana@gmail.com",
      },
    }))
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    await useCase.execute({ ...baseInput, mappingKey: "email" })

    const emailChanged = appendEventIfNewBySourceKey.mock.calls.find(
      (call) => (call[0] as { eventType: string }).eventType === "profile.email_changed",
    )
    expect(JSON.stringify(emailChanged?.[0])).not.toContain("@gmail.com")
  })

  it("dois perfis com leads distintos geram conflito explícito, sem merge", async () => {
    materializePublicFormAnswer.mockImplementation(async () => ({
      outcome: "applied",
      identityChanged: "email",
      emailChange: {
        previousNormalizedEmail: null,
        nextEmail: "ana@gmail.com",
        nextNormalizedEmail: "ana@gmail.com",
      },
    }))
    reconcileAnsweredEmail.mockImplementation(async () => ({
      winningProfileId: "profile-1",
      merged: false,
      conflict: true,
    }))
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    await useCase.execute({ ...baseInput, mappingKey: "email" })

    expect(appendEventIfNewBySourceKey).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "radar.crm_identity_conflict",
        metadata: expect.objectContaining({ conflict: true, merged: false }),
      }),
    )
  })

  it("falha técnica do repositório vira Output inválido retryable", async () => {
    materializePublicFormAnswer.mockImplementation(async () => {
      throw new Error("Radar indisponível")
    })
    const useCase = new MaterializePublicFormAnswerRevisionUseCase(repository)

    const output = await useCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Radar indisponível")
  })
})
