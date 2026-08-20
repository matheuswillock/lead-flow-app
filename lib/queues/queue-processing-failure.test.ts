import { describe, expect, it, mock } from "bun:test"
import {
  ackAfterMaxDeliveries,
  DEFAULT_QUEUE_MAX_DELIVERY_COUNT,
  formatQueueProcessingError,
  resolveQueueMaxDeliveryCount,
} from "./queue-processing-failure"

describe("ackAfterMaxDeliveries", () => {
  it("abaixo do limite: não persiste e retorna false", async () => {
    const upsertFromProcessingFailure = mock(async () => {})

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: 2,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2024"),
      },
      { upsertFromProcessingFailure },
    )

    expect(acked).toBe(false)
    expect(upsertFromProcessingFailure).not.toHaveBeenCalled()
  })

  it("deliveryCount >= 20: persiste topic/idempotencyKey/payload/lastError e retorna true (ack)", async () => {
    const upsertFromProcessingFailure = mock(async () => {})

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_MAX_DELIVERY_COUNT,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1", publicId: "pub-1" },
        lastError: new Error("Foreign key constraint violated"),
      },
      { upsertFromProcessingFailure },
    )

    expect(acked).toBe(true)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(1)
    expect(upsertFromProcessingFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1", publicId: "pub-1" },
        lastError: "Foreign key constraint violated",
      }),
    )
  })

  it("acima do limite mas persist falha: retorna false para o caller relançar", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: 25,
        topic: "asaas-webhook-events",
        idempotencyKey: "evt-asaas-1",
        payload: { eventId: "evt-asaas-1" },
        lastError: new Error("persist failed"),
      },
      { upsertFromProcessingFailure },
    )

    expect(acked).toBe(false)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(1)
  })

  it("respeita maxDeliveryCount explícito", async () => {
    const upsertFromProcessingFailure = mock(async () => {})

    const below = await ackAfterMaxDeliveries(
      {
        deliveryCount: 3,
        topic: "t",
        idempotencyKey: "k",
        payload: {},
        lastError: "x",
        maxDeliveryCount: 5,
      },
      { upsertFromProcessingFailure },
    )
    const atLimit = await ackAfterMaxDeliveries(
      {
        deliveryCount: 5,
        topic: "t",
        idempotencyKey: "k",
        payload: {},
        lastError: "x",
        maxDeliveryCount: 5,
      },
      { upsertFromProcessingFailure },
    )

    expect(below).toBe(false)
    expect(atLimit).toBe(true)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(1)
  })
})

describe("formatQueueProcessingError / resolveQueueMaxDeliveryCount", () => {
  it("corta mensagem de Error em 2000 chars", () => {
    const long = "e".repeat(3000)
    expect(formatQueueProcessingError(new Error(long)).length).toBe(2000)
  })

  it("default 20; env inválido cai no default", () => {
    expect(resolveQueueMaxDeliveryCount(undefined)).toBe(20)
    expect(resolveQueueMaxDeliveryCount("0")).toBe(20)
    expect(resolveQueueMaxDeliveryCount("abc")).toBe(20)
    expect(resolveQueueMaxDeliveryCount("7")).toBe(7)
  })
})
