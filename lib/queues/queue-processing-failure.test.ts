import { describe, expect, it, mock } from "bun:test"
import {
  ackAfterMaxDeliveries,
  ackAfterMaxDeliveriesWithOutcome,
  DEAD_LETTER_WRITE_FAILED_TAG,
  DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT,
  DEFAULT_QUEUE_MAX_DELIVERY_COUNT,
  formatQueueProcessingError,
  OUTBOX_WRITE_MAX_ATTEMPTS,
  resolveQueueHardMaxDeliveryCount,
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
      { sleep: async () => {} },
    )

    expect(acked).toBe(false)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(OUTBOX_WRITE_MAX_ATTEMPTS)
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

  it("T-Q2.1 — writer falha 2× e sucede na 3ª: grava no outbox e acka", async () => {
    let attempts = 0
    const upsertFromProcessingFailure = mock(async () => {
      attempts += 1
      if (attempts < OUTBOX_WRITE_MAX_ATTEMPTS) {
        throw new Error("outbox indisponível")
      }
    })
    const delays: number[] = []

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: 25,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      {
        sleep: async (ms) => {
          delays.push(ms)
        },
      },
    )

    expect(acked).toBe(true)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([200, 500])
  })

  it("T-Q2.2 — writer falha sempre e deliveryCount < HARD_MAX: retém para retry", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT - 1,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      { sleep: async () => {} },
    )

    expect(acked).toBe(false)
    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(OUTBOX_WRITE_MAX_ATTEMPTS)
  })

  it("T-Q2.2 — writer falha sempre e deliveryCount >= HARD_MAX: acka e loga o payload com a tag", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })
    const logged: unknown[][] = []

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1", publicId: "pub-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      {
        sleep: async () => {},
        logError: (...args: unknown[]) => logged.push(args),
      },
    )

    expect(acked).toBe(true)
    const hardCutLog = logged.find((entry) =>
      String(entry[0]).includes(DEAD_LETTER_WRITE_FAILED_TAG),
    )
    expect(hardCutLog).toBeDefined()
    expect(hardCutLog?.[1]).toEqual(
      expect.objectContaining({
        tag: DEAD_LETTER_WRITE_FAILED_TAG,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        deliveryCount: DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT,
        ackedWithoutOutbox: true,
        payload: { eventKey: "evt-1", publicId: "pub-1" },
      }),
    )
  })

  it("T-Q2.2 — falha final da escrita sempre emite a tag alertável, mesmo sem corte duro", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })
    const logged: unknown[][] = []

    await ackAfterMaxDeliveries(
      {
        deliveryCount: 25,
        topic: "asaas-webhook-events",
        idempotencyKey: "evt-asaas-1",
        payload: { eventId: "evt-asaas-1" },
        lastError: new Error("persist failed"),
      },
      { upsertFromProcessingFailure },
      {
        sleep: async () => {},
        logError: (...args: unknown[]) => logged.push(args),
      },
    )

    const taggedLog = logged.find((entry) => String(entry[0]).includes(DEAD_LETTER_WRITE_FAILED_TAG))
    expect(taggedLog?.[1]).toEqual(
      expect.objectContaining({
        tag: DEAD_LETTER_WRITE_FAILED_TAG,
        ackedWithoutOutbox: false,
      }),
    )
  })

  it("onOutboxOutcome(true) quando a escrita no outbox tem sucesso", async () => {
    const upsertFromProcessingFailure = mock(async () => {})
    const onOutboxOutcome = mock((_persisted: boolean) => {})

    await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_MAX_DELIVERY_COUNT,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      { onOutboxOutcome },
    )

    expect(onOutboxOutcome).toHaveBeenCalledTimes(1)
    expect(onOutboxOutcome).toHaveBeenCalledWith(true)
  })

  it("onOutboxOutcome(false) só quando o corte duro acka sem outbox", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })
    const onOutboxOutcome = mock((_persisted: boolean) => {})

    await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      { sleep: async () => {}, onOutboxOutcome },
    )

    expect(onOutboxOutcome).toHaveBeenCalledTimes(1)
    expect(onOutboxOutcome).toHaveBeenCalledWith(false)
  })

  it("onOutboxOutcome não é chamado quando o caller ainda vai relançar (não ackou)", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })
    const onOutboxOutcome = mock((_persisted: boolean) => {})

    const acked = await ackAfterMaxDeliveries(
      {
        deliveryCount: DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT - 1,
        topic: "public-form-metric-events",
        idempotencyKey: "evt-1",
        payload: { eventKey: "evt-1" },
        lastError: new Error("P2003"),
      },
      { upsertFromProcessingFailure },
      { sleep: async () => {}, onOutboxOutcome },
    )

    expect(acked).toBe(false)
    expect(onOutboxOutcome).not.toHaveBeenCalled()
  })
})

describe("ackAfterMaxDeliveriesWithOutcome", () => {
  it("repassa o outcome sem exigir que o caller injete um writer", async () => {
    const onOutboxOutcome = mock((_persisted: boolean) => {})

    const acked = await ackAfterMaxDeliveriesWithOutcome(
      {
        deliveryCount: 2,
        topic: "t",
        idempotencyKey: "k",
        payload: {},
        lastError: "x",
      },
      onOutboxOutcome,
    )

    expect(acked).toBe(false)
    expect(onOutboxOutcome).not.toHaveBeenCalled()
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

  it("corte duro: default 100, env inválido cai no default, nunca abaixo do limite normal", () => {
    expect(resolveQueueHardMaxDeliveryCount(undefined)).toBe(DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT)
    expect(resolveQueueHardMaxDeliveryCount("abc")).toBe(DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT)
    expect(resolveQueueHardMaxDeliveryCount("250")).toBe(250)
    expect(resolveQueueHardMaxDeliveryCount("5", 20)).toBe(20)
  })
})
