import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { QueueProcessingFailureClaimRow } from "@/app/api/infra/data/repositories/queueProcessingFailure/IQueueProcessingFailureRepository"
import { ASAAS_WEBHOOK_EVENTS_TOPIC } from "@/lib/queues/asaas-webhook-events"
import { PUBLIC_FORM_METRIC_EVENTS_TOPIC } from "@/lib/queues/public-form-metric-events"

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
}))

mock.module(
  "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository",
  () => ({
    queueProcessingFailureRepository: {},
  }),
)

const claimDueMock = mock(async () => [] as QueueProcessingFailureClaimRow[])
const markResolvedMock = mock(async () => {})
const markRetryOrFailedMock = mock(async (): Promise<"retried" | "failed"> => "retried")
const requeueIfProcessingMock = mock(async () => {})

mock.module("@/lib/queues/queue-processing-failure-republish", () => ({
  QUEUE_PROCESSING_FAILURE_REPUBLISHERS: {},
  QUEUE_PROCESSING_FAILURE_DEDICATED_RETRY_TOPICS: new Set([ASAAS_WEBHOOK_EVENTS_TOPIC]),
}))

const { RetryQueueProcessingFailuresUseCase } = await import(
  "./RetryQueueProcessingFailuresUseCase"
)

const repository = {
  claimDue: claimDueMock,
  markResolved: markResolvedMock,
  markRetryOrFailed: markRetryOrFailedMock,
  requeueIfProcessing: requeueIfProcessingMock,
  upsertFromProcessingFailure: mock(async () => {}),
}

describe("RetryQueueProcessingFailuresUseCase", () => {
  const republishMetric = mock(async () => {})

  beforeEach(() => {
    claimDueMock.mockClear()
    markResolvedMock.mockClear()
    markRetryOrFailedMock.mockClear()
    requeueIfProcessingMock.mockClear()
    republishMetric.mockClear()
    claimDueMock.mockImplementation(async () => [])
    republishMetric.mockImplementation(async () => {})
    markRetryOrFailedMock.mockImplementation(async () => "retried")
  })

  it("republica via mapa topic → publish e marca resolved", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        topic: PUBLIC_FORM_METRIC_EVENTS_TOPIC,
        idempotencyKey: "session-1:form_completed:form",
        payload: { eventKey: "session-1:form_completed:form" },
        attemptCount: 1,
      },
    ])

    const useCase = new RetryQueueProcessingFailuresUseCase(repository, {
      [PUBLIC_FORM_METRIC_EVENTS_TOPIC]: republishMetric,
    })
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(republishMetric).toHaveBeenCalledWith(
      { eventKey: "session-1:form_completed:form" },
      "session-1:form_completed:form:outbox-retry:row-1:1",
    )
    expect(markResolvedMock).toHaveBeenCalledWith("row-1")
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 })
  })

  it("Asaas: não republica na fila (cron dedicado segue) e marca resolved", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-asaas",
        topic: ASAAS_WEBHOOK_EVENTS_TOPIC,
        idempotencyKey: "evt-1",
        payload: { eventId: "evt-1" },
        attemptCount: 1,
      },
    ])

    const useCase = new RetryQueueProcessingFailuresUseCase(repository, {
      [PUBLIC_FORM_METRIC_EVENTS_TOPIC]: republishMetric,
    })
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(republishMetric).not.toHaveBeenCalled()
    expect(markResolvedMock).toHaveBeenCalledWith("row-asaas")
  })

  it("tópico sem mapa: marca retry/failed sem publish", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-unknown",
        topic: "unknown-topic",
        idempotencyKey: "k",
        payload: {},
        attemptCount: 1,
      },
    ])

    const useCase = new RetryQueueProcessingFailuresUseCase(repository, {})
    await useCase.execute()

    expect(markRetryOrFailedMock).toHaveBeenCalledWith(
      "row-unknown",
      2,
      "Tópico sem mapa de republicação: unknown-topic",
    )
    expect(markResolvedMock).not.toHaveBeenCalled()
  })

  it("publish falha: markRetryOrFailed", async () => {
    republishMetric.mockImplementation(async () => {
      throw new Error("queue down")
    })
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        topic: PUBLIC_FORM_METRIC_EVENTS_TOPIC,
        idempotencyKey: "k",
        payload: {},
        attemptCount: 1,
      },
    ])

    const useCase = new RetryQueueProcessingFailuresUseCase(repository, {
      [PUBLIC_FORM_METRIC_EVENTS_TOPIC]: republishMetric,
    })
    await useCase.execute()

    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-1", 2, "queue down")
    expect(markResolvedMock).not.toHaveBeenCalled()
  })
})
