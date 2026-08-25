import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const TEAM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const QUESTION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

const questionFromSnapshot = { id: QUESTION_ID, title: "Qual seu orçamento?", type: "single_choice" }

const findPublishedByPublicId = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: {
    formId: FORM_ID,
    questions: [questionFromSnapshot] as Array<{
      id: string
      title?: string
      type?: string
      mappingKey?: string
    }>,
  },
}))
const findAvailabilityTeamContext = mock(async () => ({
  teamId: TEAM_ID,
  name: "Form",
  publicId: PUBLIC_ID,
  emailCampaignTrackingEnabled: false,
  team: { master: { timezone: "America/Sao_Paulo" } },
}))
type UpsertMetricEventArgs = {
  questionId?: string | null
  questionSnapshot?: unknown
  publicationId?: string
}

const upsertMetricEvent = mock(async (_args: UpsertMetricEventArgs) => {})
const questionExists = mock(async (_id: string) => true)
const findPublicationContainingQuestion = mock(async () => null as {
  publicationId: string
  snapshot: { formId: string; questions: Array<{ id: string; title?: string; type?: string }> }
} | null)

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublishedByPublicId,
    findAvailabilityTeamContext,
    upsertMetricEvent,
    questionExists,
    findPublicationContainingQuestion,
  },
}))

mock.module("@/app/api/useCases/radar/syncPublicFormMetricToRadarFactory", () => ({
  syncPublicFormMetricToRadarUseCase: { execute: mock(async () => new Output(true, [], [], { created: true })) },
}))

mock.module("@/app/api/useCases/radar/syncPublicFormMetricToRadarInline", () => ({
  syncPublicFormMetricToRadarInline: mock(() => {}),
}))

mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: {
    execute: mock(async () => new Output(true, [], [], null)),
  },
}))

const { PublicFormsService } = await import("./PublicFormsService")

describe("PublicFormsService.recordMetric questionSnapshot", () => {
  const service = new PublicFormsService()

  beforeEach(() => {
    findPublishedByPublicId.mockClear()
    findAvailabilityTeamContext.mockClear()
    upsertMetricEvent.mockClear()
    questionExists.mockClear()
    questionExists.mockResolvedValue(true)
    findPublicationContainingQuestion.mockClear()
    findPublicationContainingQuestion.mockResolvedValue(null)
  })

  it("resolve questionSnapshot a partir do snapshot da publicação vigente quando questionId existe", async () => {
    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_viewed",
      eventKey: "session_abcdefghij:question_viewed:q1",
      questionId: QUESTION_ID,
      origin: {},
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    const call = upsertMetricEvent.mock.calls[0]
    if (!call) throw new Error("Expected upsertMetricEvent to have been called")
    expect(call[0].questionId).toBe(QUESTION_ID)
    expect(call[0].questionSnapshot).toEqual(questionFromSnapshot)
    expect(call[0].publicationId).toBe(PUBLICATION_ID)
  })

  it("persiste na publicação anterior quando questionId não existe no snapshot vigente", async () => {
    const previousPublicationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    const staleQuestion = { id: "stale-question-id-not-in-snapshot", title: "Pergunta antiga", type: "single_choice" }
    findPublicationContainingQuestion.mockResolvedValueOnce({
      publicationId: previousPublicationId,
      snapshot: {
        formId: FORM_ID,
        questions: [staleQuestion],
      },
    })

    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_viewed",
      eventKey: "session_abcdefghij:question_viewed:stale",
      questionId: staleQuestion.id,
      origin: {},
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(findPublicationContainingQuestion).toHaveBeenCalledWith(FORM_ID, staleQuestion.id)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    const call = upsertMetricEvent.mock.calls[0]
    if (!call) throw new Error("Expected upsertMetricEvent to have been called")
    expect(call[0].publicationId).toBe(previousPublicationId)
    expect(call[0].questionId).toBe(staleQuestion.id)
    expect(call[0].questionSnapshot).toEqual(staleQuestion)
  })

  it("id órfão (nenhuma publicação contém o questionId): persiste no vigente sem FK e ACK sem throw", async () => {
    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_viewed",
      eventKey: "session_abcdefghij:question_viewed:orphan",
      questionId: "orphan-question-id",
      origin: {},
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    const call = upsertMetricEvent.mock.calls[0]
    if (!call) throw new Error("Expected upsertMetricEvent to have been called")
    expect(call[0].publicationId).toBe(PUBLICATION_ID)
    expect(call[0].questionId).toBeNull()
    expect(call[0].questionSnapshot).toBeNull()
  })

  it("questionId presente no snapshot mas ausente na tabela viva: persiste com questionId null preservando o questionSnapshot", async () => {
    questionExists.mockResolvedValueOnce(false)

    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_answered",
      eventKey: "session_abcdefghij:question_answered:q1",
      questionId: QUESTION_ID,
      origin: {},
      answerValue: "R$ 1.000",
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(questionExists).toHaveBeenCalledWith(QUESTION_ID)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    const call = upsertMetricEvent.mock.calls[0]
    if (!call) throw new Error("Expected upsertMetricEvent to have been called")
    expect(call[0].questionId).toBeNull()
    expect(call[0].questionSnapshot).toEqual(questionFromSnapshot)
  })

  it("questionSnapshot é null quando o evento não referencia uma pergunta", async () => {
    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "form_viewed",
      eventKey: "session_abcdefghij:form_viewed:form",
      origin: {},
    }

    await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    const call = upsertMetricEvent.mock.calls[0]
    if (!call) throw new Error("Expected upsertMetricEvent to have been called")
    expect(call[0].questionSnapshot).toBeNull()
  })

  it("question_answered sem answerValue em escolha ainda persiste e pode ir ao Radar", async () => {
    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_answered",
      eventKey: "session_abcdefghij:question_answered:q1",
      questionId: QUESTION_ID,
      origin: {},
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
  })

  it("question_answered de identidade (name) vazio não persiste nem consome a chave", async () => {
    findPublishedByPublicId.mockResolvedValueOnce({
      publicationId: PUBLICATION_ID,
      snapshot: {
        formId: FORM_ID,
        questions: [{ id: QUESTION_ID, title: "Nome", type: "text", mappingKey: "name" }],
      },
    })

    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_answered",
      eventKey: "session_abcdefghij:question_answered:q1",
      questionId: QUESTION_ID,
      origin: {},
      answerValue: "  ",
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(true)
    expect(upsertMetricEvent).not.toHaveBeenCalled()
  })
})
