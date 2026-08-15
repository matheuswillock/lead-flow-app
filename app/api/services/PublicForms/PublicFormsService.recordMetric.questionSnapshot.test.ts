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
    questions: [questionFromSnapshot] as Array<{ id: string }>,
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
}

const upsertMetricEvent = mock(async (_args: UpsertMetricEventArgs) => {})

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublishedByPublicId,
    findAvailabilityTeamContext,
    upsertMetricEvent,
  },
}))

mock.module("@/app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase", () => ({
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
  })

  it("retorna false (sem persistir) quando questionId não existe no snapshot vigente", async () => {
    const input: PublicFormMetricEventInput = {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_viewed",
      eventKey: "session_abcdefghij:question_viewed:stale",
      questionId: "stale-question-id-not-in-snapshot",
      origin: {},
    }

    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })

    expect(accepted).toBe(false)
    expect(upsertMetricEvent).not.toHaveBeenCalled()
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
})
