import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormQueueEventFailureClaimRow } from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"

const claimDueMock = mock(async () => [] as PublicFormQueueEventFailureClaimRow[])
const markResolvedMock = mock(async () => {})
const markRetryOrFailedMock = mock(async (): Promise<"retried" | "failed"> => "retried")
const requeueIfProcessingMock = mock(async () => {})
const publishPublicFormMetricEventMock = mock(
  async (_payload: unknown, _options?: { idempotencyKey?: string }) => ({ messageId: "msg-1" }),
)
const publishPublicFormSubmissionEventMock = mock(
  async (_payload: unknown, _options?: { idempotencyKey?: string }) => ({ messageId: "msg-1" }),
)

mock.module("@/lib/queues/public-form-metric-events", () => ({
  publishPublicFormMetricEvent: publishPublicFormMetricEventMock,
}))
mock.module("@/lib/queues/public-form-submission-events", () => ({
  publishPublicFormSubmissionEvent: publishPublicFormSubmissionEventMock,
}))

const { RetryPublicFormQueueEventFailuresUseCase } = await import(
  "./RetryPublicFormQueueEventFailuresUseCase"
)

const repository = {
  claimDue: claimDueMock,
  markResolved: markResolvedMock,
  markRetryOrFailed: markRetryOrFailedMock,
  requeueIfProcessing: requeueIfProcessingMock,
  upsertFromProcessingFailure: mock(async () => {}),
}

describe("RetryPublicFormQueueEventFailuresUseCase (republish-to-queue)", () => {
  beforeEach(() => {
    claimDueMock.mockClear()
    markResolvedMock.mockClear()
    markRetryOrFailedMock.mockClear()
    requeueIfProcessingMock.mockClear()
    publishPublicFormMetricEventMock.mockClear()
    publishPublicFormSubmissionEventMock.mockClear()
    claimDueMock.mockImplementation(async () => [])
    publishPublicFormMetricEventMock.mockImplementation(async () => ({ messageId: "msg-1" }))
    publishPublicFormSubmissionEventMock.mockImplementation(async () => ({ messageId: "msg-1" }))
    markRetryOrFailedMock.mockImplementation(async () => "retried")
  })

  it("kind=metric: republica na fila public-form-metric-events e marca resolved", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        kind: "metric",
        idempotencyKey: "session-1:form_completed:form",
        payload: {
          publicId: "pub-1",
          eventKey: "session-1:form_completed:form",
          eventType: "form_completed",
          questionId: null,
          visitorSessionId: "session-1",
          origin: {},
          receivedAt: "2026-08-15T00:00:00.000Z",
        },
        attemptCount: 1,
      },
    ])

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(publishPublicFormMetricEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: "pub-1", eventType: "form_completed" }),
      { idempotencyKey: "session-1:form_completed:form:outbox-retry:row-1:1" },
    )
    expect(publishPublicFormSubmissionEventMock).not.toHaveBeenCalled()
    expect(markResolvedMock).toHaveBeenCalledWith("row-1")
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 })
  })

  it("kind=submission: republica na fila public-form-submission-events e marca resolved", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-2",
        kind: "submission",
        idempotencyKey: "req-abc",
        payload: {
          submissionId: "sub-1",
          publicationId: "pub-1",
          snapshot: { formId: "form-1", questions: [] },
          visibleAnswers: [],
          visibleIds: [],
          score: 90,
          scoreBandLabel: "Quente",
          origin: {},
          requestKey: "req-abc",
        },
        attemptCount: 1,
      },
    ])

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(publishPublicFormSubmissionEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "sub-1", requestKey: "req-abc" }),
      { idempotencyKey: "req-abc:outbox-retry:row-2:1" },
    )
    expect(publishPublicFormMetricEventMock).not.toHaveBeenCalled()
    expect(markResolvedMock).toHaveBeenCalledWith("row-2")
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 })
  })

  it("reenfileira após falha transitória de publish", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        kind: "submission",
        idempotencyKey: "req-xyz",
        payload: { submissionId: "sub-2", requestKey: "req-xyz", snapshot: { questions: [] } },
        attemptCount: 2,
      },
    ])
    publishPublicFormSubmissionEventMock.mockImplementation(async () => {
      throw new Error("timeout de rede")
    })
    markRetryOrFailedMock.mockImplementation(async () => "retried")

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 3, expect.any(String))
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 1, failed: 0 })
  })

  it("marca failed após esgotar tentativas de publish", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-4",
        kind: "metric",
        idempotencyKey: "session-2:form_completed:form",
        payload: {
          publicId: "pub-1",
          eventKey: "session-2:form_completed:form",
          eventType: "form_completed",
          questionId: null,
          visitorSessionId: "session-2",
          origin: {},
          receivedAt: "2026-08-15T00:00:00.000Z",
        },
        attemptCount: 5,
      },
    ])
    publishPublicFormMetricEventMock.mockImplementation(async () => {
      throw new Error("erro permanente")
    })
    markRetryOrFailedMock.mockImplementation(async () => "failed")

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-4", 6, expect.any(String))
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 0, failed: 1 })
  })

  it("reenfileira o lote e retorna Output inválido quando claimDue falha", async () => {
    claimDueMock.mockImplementation(async () => {
      throw new Error("falha no claim")
    })

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual([
      "Erro ao reprocessar falhas de fila de formulários públicos",
    ])
    expect(requeueIfProcessingMock).toHaveBeenCalledWith([])
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(markRetryOrFailedMock).not.toHaveBeenCalled()
  })

  it("usa idempotencyKey própria por tentativa, nunca reaproveitando a eventKey original (evita dedupe silencioso na Vercel Queues)", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-5",
        kind: "metric",
        idempotencyKey: "session-5:form_completed:form",
        payload: {
          publicId: "pub-1",
          eventKey: "session-5:form_completed:form",
          eventType: "form_completed",
          questionId: null,
          visitorSessionId: "session-5",
          origin: {},
          receivedAt: "2026-08-15T00:00:00.000Z",
        },
        attemptCount: 3,
      },
    ])

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    await useCase.execute()

    const call = publishPublicFormMetricEventMock.mock.calls[0] as
      | [unknown, { idempotencyKey: string }]
      | undefined
    expect(call?.[1].idempotencyKey).toBe("session-5:form_completed:form:outbox-retry:row-5:3")
    expect(call?.[1].idempotencyKey).not.toBe("session-5:form_completed:form")
  })

  it("processa múltiplas linhas em paralelo (chunks de concorrência)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `row-${i}`,
      kind: "metric" as const,
      idempotencyKey: `session-${i}:form_completed:form`,
      payload: {
        publicId: "pub-1",
        eventKey: `session-${i}:form_completed:form`,
        eventType: "form_completed",
        questionId: null,
        visitorSessionId: `session-${i}`,
        origin: {},
        receivedAt: "2026-08-15T00:00:00.000Z",
      },
      attemptCount: 1,
    }))
    claimDueMock.mockImplementation(async () => rows)

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(repository)
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(publishPublicFormMetricEventMock).toHaveBeenCalledTimes(5)
    expect(markResolvedMock).toHaveBeenCalledTimes(5)
  })
})
