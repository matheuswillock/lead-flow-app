import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PublicFormQueueEventFailureClaimRow } from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"

const claimDueMock = mock(async () => [] as PublicFormQueueEventFailureClaimRow[])
const markResolvedMock = mock(async () => {})
const markRetryOrFailedMock = mock(async (): Promise<"retried" | "failed"> => "retried")
const requeueIfProcessingMock = mock(async () => {})
const persistQueuedMetricMock = mock(async () => true)
const processInBackgroundMock = mock(async () => {})

// PublicFormSubmissionUseCase.ts carrega uma cadeia pesada de serviços
// (lead/agenda/Google) que não pode ser importada em teste sem mock — o
// singleton exportado nunca deve ser instanciado de verdade aqui.
mock.module("@/app/api/useCases/publicForms/PublicFormSubmissionUseCase", () => ({
  publicFormSubmissionUseCase: { processInBackground: processInBackgroundMock },
}))
mock.module("@/app/api/useCases/publicForms/PublicFormsUseCase", () => ({
  publicFormsUseCase: { persistQueuedMetric: persistQueuedMetricMock },
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

const metricsUseCase = { persistQueuedMetric: persistQueuedMetricMock }
const submissionUseCase = { processInBackground: processInBackgroundMock }

describe("RetryPublicFormQueueEventFailuresUseCase (PR2.3)", () => {
  beforeEach(() => {
    claimDueMock.mockClear()
    markResolvedMock.mockClear()
    markRetryOrFailedMock.mockClear()
    requeueIfProcessingMock.mockClear()
    persistQueuedMetricMock.mockClear()
    processInBackgroundMock.mockClear()
    claimDueMock.mockImplementation(async () => [])
    persistQueuedMetricMock.mockImplementation(async () => true)
    processInBackgroundMock.mockImplementation(async () => {})
    markRetryOrFailedMock.mockImplementation(async () => "retried")
  })

  it("kind=metric: reprocessa via persistQueuedMetric e marca resolved", async () => {
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

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(
      repository,
      metricsUseCase,
      submissionUseCase,
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(persistQueuedMetricMock).toHaveBeenCalledWith(
      "pub-1",
      expect.objectContaining({ eventType: "form_completed", visitorSessionId: "session-1" }),
    )
    expect(processInBackgroundMock).not.toHaveBeenCalled()
    expect(markResolvedMock).toHaveBeenCalledWith("row-1")
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 })
  })

  it("kind=submission: reprocessa via processInBackground e marca resolved", async () => {
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

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(
      repository,
      metricsUseCase,
      submissionUseCase,
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(processInBackgroundMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "sub-1", requestKey: "req-abc" }),
    )
    expect(persistQueuedMetricMock).not.toHaveBeenCalled()
    expect(markResolvedMock).toHaveBeenCalledWith("row-2")
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 })
  })

  it("reenfileira após falha transitória", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        kind: "submission",
        idempotencyKey: "req-xyz",
        payload: { submissionId: "sub-2", requestKey: "req-xyz", snapshot: { questions: [] } },
        attemptCount: 2,
      },
    ])
    processInBackgroundMock.mockImplementation(async () => {
      throw new Error("timeout de pool")
    })
    markRetryOrFailedMock.mockImplementation(async () => "retried")

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(
      repository,
      metricsUseCase,
      submissionUseCase,
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 3, "timeout de pool")
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 1, failed: 0 })
  })

  it("marca failed após esgotar tentativas", async () => {
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
    persistQueuedMetricMock.mockImplementation(async () => {
      throw new Error("erro permanente")
    })
    markRetryOrFailedMock.mockImplementation(async () => "failed")

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(
      repository,
      metricsUseCase,
      submissionUseCase,
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-4", 6, "erro permanente")
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 0, failed: 1 })
  })

  it("reenfileira o lote e retorna Output inválido quando claimDue falha", async () => {
    claimDueMock.mockImplementation(async () => {
      throw new Error("falha no claim")
    })

    const useCase = new RetryPublicFormQueueEventFailuresUseCase(
      repository,
      metricsUseCase,
      submissionUseCase,
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual([
      "Erro ao reprocessar falhas de fila de formulários públicos",
    ])
    expect(requeueIfProcessingMock).toHaveBeenCalledWith([])
    expect(markResolvedMock).not.toHaveBeenCalled()
    expect(markRetryOrFailedMock).not.toHaveBeenCalled()
  })
})
