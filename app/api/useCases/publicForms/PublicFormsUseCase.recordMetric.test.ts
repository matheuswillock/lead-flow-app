import { describe, it, expect, mock, beforeEach } from "bun:test"
import {
  PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
} from "@/lib/queues/public-form-metric-events"
import { DEFAULT_PUBLISH_RETRY_ATTEMPTS } from "@/lib/queues/publish-with-retry"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

const publishPublicFormMetricEvent = mock(async () => ({ messageId: "msg-queue-1" }))
const buildPublicFormMetricQueuePayload = mock(
  (publicId: string, input: PublicFormMetricEventInput) => ({
    publicId,
    eventKey: input.eventKey,
    eventType: input.eventType,
    questionId: input.questionId ?? null,
    visitorSessionId: input.visitorSessionId,
    origin: input.origin ?? {},
    receivedAt: "2026-08-11T12:00:00.000Z",
  }),
)
const recordMetricService = mock(async () => true)
const upsertFromProcessingFailureMock = mock(async () => {})

mock.module("@/lib/queues/public-form-metric-events", () => ({
  publishPublicFormMetricEvent,
  buildPublicFormMetricQueuePayload,
  PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
}))

mock.module(
  "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository",
  () => ({
    formatProcessingError: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
    publicFormQueueEventFailureRepository: {
      upsertFromProcessingFailure: upsertFromProcessingFailureMock,
    },
  }),
)

mock.module("@/app/api/infra/data/prisma", () => ({
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
  default: {},
  prisma: {},
}))

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: {
    recordMetric: recordMetricService,
    getSettings: mock(async () => ({ approverRoles: [] })),
  },
  buildPublicFormPreviewSnapshot: mock(() => ({})),
  mapPublicFormDraft: mock(() => ({})),
}))

const { PublicFormsUseCase } = await import("./PublicFormsUseCase")

const VALID_PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const VALID_SESSION = "session_abcdefghij"

function metricInput(
  eventType: PublicFormMetricEventInput["eventType"],
): PublicFormMetricEventInput {
  return {
    visitorSessionId: VALID_SESSION,
    eventType,
    eventKey: `${VALID_SESSION}:${eventType}:form`,
    origin: { source: "test" },
  }
}

describe("PublicFormsUseCase.recordMetric queue-first (PR2.3: sem bypass direto)", () => {
  const useCase = new PublicFormsUseCase()

  beforeEach(() => {
    publishPublicFormMetricEvent.mockReset()
    publishPublicFormMetricEvent.mockResolvedValue({ messageId: "msg-queue-1" })
    buildPublicFormMetricQueuePayload.mockClear()
    recordMetricService.mockReset()
    recordMetricService.mockResolvedValue(true)
    upsertFromProcessingFailureMock.mockReset()
  })

  it("evento antes crítico (form_viewed) publica na fila sem chamar publicFormsService.recordMetric", async () => {
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, metricInput("form_viewed"))
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ queued: true, messageId: "msg-queue-1" })
    expect(publishPublicFormMetricEvent).toHaveBeenCalledTimes(1)
    const published = publishPublicFormMetricEvent.mock.calls[0] as unknown as [
      { publicId: string; eventType: string; eventKey: string },
    ]
    expect(published[0]).toMatchObject({
      publicId: VALID_PUBLIC_ID,
      eventType: "form_viewed",
      eventKey: `${VALID_SESSION}:form_viewed:form`,
    })
    expect(recordMetricService).not.toHaveBeenCalled()
  })

  it("evento antes não-crítico (question_viewed) também publica na fila agora — sem bypass direto", async () => {
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, {
      visitorSessionId: VALID_SESSION,
      eventType: "question_viewed",
      eventKey: `${VALID_SESSION}:question_viewed:q1`,
      questionId: "11111111-1111-4111-8111-111111111111",
      origin: {},
    })
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ queued: true, messageId: "msg-queue-1" })
    expect(publishPublicFormMetricEvent).toHaveBeenCalledTimes(1)
    expect(recordMetricService).not.toHaveBeenCalled()
  })

  it("form_started publica na fila sem chamar o service", async () => {
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, metricInput("form_started"))
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ queued: true, messageId: "msg-queue-1" })
    expect(publishPublicFormMetricEvent).toHaveBeenCalledTimes(1)
    expect(recordMetricService).not.toHaveBeenCalled()
  })

  it("publish falha 3x → grava no outbox com queue_publish_failed e ainda responde sucesso ao cliente", async () => {
    publishPublicFormMetricEvent.mockRejectedValue(new Error("queue down"))
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, metricInput("form_completed"))

    expect(publishPublicFormMetricEvent).toHaveBeenCalledTimes(DEFAULT_PUBLISH_RETRY_ATTEMPTS)
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ queued: false, fallback: true })
    expect(upsertFromProcessingFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "metric",
        idempotencyKey: `${VALID_SESSION}:form_completed:form`,
        failureReason: "queue_publish_failed",
      }),
    )
    expect(recordMetricService).not.toHaveBeenCalled()
  })

  it("publish falha 3x e outbox também falha → devolve erro ao cliente (evento não fica sem rastro)", async () => {
    publishPublicFormMetricEvent.mockRejectedValue(new Error("queue down"))
    upsertFromProcessingFailureMock.mockRejectedValueOnce(new Error("db down"))

    const output = await useCase.recordMetric(VALID_PUBLIC_ID, metricInput("form_completed"))
    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ code: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG })
  })

  it("persistQueuedMetric chama recordMetric com radarMode inline", async () => {
    const accepted = await useCase.persistQueuedMetric(VALID_PUBLIC_ID, {
      visitorSessionId: VALID_SESSION,
      eventType: "form_viewed",
      eventKey: `${VALID_SESSION}:form_viewed:form`,
      origin: {},
    })
    expect(accepted).toBe(true)
    expect(recordMetricService).toHaveBeenCalledTimes(1)
    expect(recordMetricService).toHaveBeenCalledWith(
      VALID_PUBLIC_ID,
      expect.objectContaining({ eventType: "form_viewed" }),
      { radarMode: "inline" },
    )
  })

  it("persistQueuedMetric propaga erro do Radar para retry do consumer", async () => {
    recordMetricService.mockRejectedValueOnce(new Error("Perfil Radar não resolvido"))
    await expect(
      useCase.persistQueuedMetric(VALID_PUBLIC_ID, {
        visitorSessionId: VALID_SESSION,
        eventType: "form_completed",
        eventKey: `${VALID_SESSION}:form_completed:form`,
        origin: {},
      }),
    ).rejects.toThrow("Perfil Radar não resolvido")
  })
})
