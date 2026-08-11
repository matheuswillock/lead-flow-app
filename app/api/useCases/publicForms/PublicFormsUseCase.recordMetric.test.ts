import { describe, it, expect, mock, beforeEach } from "bun:test"
import {
  PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
} from "@/lib/queues/public-form-metric-events"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

const publishPublicFormMetricEvent = mock(async () => ({ messageId: "msg-queue-1" }))
const isCriticalPublicFormMetricEvent = mock((eventType: string) =>
  eventType === "form_viewed" ||
  eventType === "question_answered" ||
  eventType === "form_completed",
)
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

mock.module("@/lib/queues/public-form-metric-events", () => ({
  publishPublicFormMetricEvent,
  isCriticalPublicFormMetricEvent,
  buildPublicFormMetricQueuePayload,
  PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
}))

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

function criticalInput(
  eventType: "form_viewed" | "question_answered" | "form_completed",
): PublicFormMetricEventInput {
  return {
    visitorSessionId: VALID_SESSION,
    eventType,
    eventKey: `${VALID_SESSION}:${eventType}:form`,
    origin: { source: "test" },
  }
}

describe("PublicFormsUseCase.recordMetric queue-first", () => {
  const useCase = new PublicFormsUseCase()

  beforeEach(() => {
    publishPublicFormMetricEvent.mockReset()
    publishPublicFormMetricEvent.mockResolvedValue({ messageId: "msg-queue-1" })
    isCriticalPublicFormMetricEvent.mockClear()
    buildPublicFormMetricQueuePayload.mockClear()
    recordMetricService.mockReset()
    recordMetricService.mockResolvedValue(true)
  })

  it("evento crítico publica na fila sem chamar publicFormsService.recordMetric", async () => {
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, criticalInput("form_viewed"))
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

  it("evento não crítico usa caminho direto recordMetric", async () => {
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, {
      visitorSessionId: VALID_SESSION,
      eventType: "form_started",
      eventKey: `${VALID_SESSION}:form_started:form`,
      origin: {},
    })
    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ accepted: true })
    expect(publishPublicFormMetricEvent).not.toHaveBeenCalled()
    expect(recordMetricService).toHaveBeenCalledTimes(1)
  })

  it("falha de publish instrumenta tag e não chama recordMetric", async () => {
    publishPublicFormMetricEvent.mockRejectedValueOnce(new Error("queue down"))
    const output = await useCase.recordMetric(VALID_PUBLIC_ID, criticalInput("form_completed"))
    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ code: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG })
    expect(recordMetricService).not.toHaveBeenCalled()
  })
})
