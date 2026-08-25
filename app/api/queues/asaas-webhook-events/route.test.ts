import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { AsaasWebhookBody } from "@/app/api/webhooks/asaas/processAsaasWebhookEvent"
import type { AsaasWebhookEventPayload } from "@/lib/queues/asaas-webhook-events"

mock.module("@/lib/queues/asaas-webhook-events", () => ({
  handleAsaasWebhookEventsCallback: (
    handler: (
      message: AsaasWebhookEventPayload,
      metadata: QueueMessageMetadata
    ) => Promise<void>
  ) => handler,
  publishAsaasWebhookEvent: mock(async () => ({ messageId: "mid-test" })),
  ASAAS_WEBHOOK_EVENTS_TOPIC: "asaas-webhook-events",
  ASAAS_WEBHOOK_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
}))

/**
 * Só o repositório é stubado — `queue-processing-failure` roda de verdade. É o
 * que faz a chave e o `reason` assertados aqui serem os mesmos que produção
 * grava; reimplementar os helpers dentro do mock passaria sempre.
 */
const recordTerminalFailure = mock(async (_input: unknown) => {})
const upsertFromProcessingFailure = mock(async (_input: unknown) => {})

mock.module(
  "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository",
  () => ({
    queueProcessingFailureRepository: { recordTerminalFailure, upsertFromProcessingFailure },
  }),
)

mock.module("@/app/api/webhooks/asaas/processAsaasWebhookEvent", () => ({
  processAsaasWebhookEvent: mock(async () => {}),
}))

mock.module("@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository", () => ({
  asaasWebhookEventRepository: {
    markProcessed: mock(async () => {}),
    markFailed: mock(async () => {}),
    claimForProcessing: mock(async () => "process"),
  },
}))

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

const { processAsaasWebhookEventMessage } = await import("./route")

const process = mock(async (_body: AsaasWebhookBody) => {})
const markProcessed = mock(async (_id: string) => {})
const markFailed = mock(async (_id: string, _errorMessage: string) => {})

const deps = { process, markProcessed, markFailed }

const baseBody = (): AsaasWebhookBody => ({
  id: "evt-1",
  event: "PAYMENT_RECEIVED",
  payment: {
    id: "pay-1",
    status: "RECEIVED",
  },
})

const baseMessage = (): AsaasWebhookEventPayload => ({
  eventId: "evt-1",
  body: baseBody(),
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "asaas-webhook-events",
  region: "gru1",
}

describe("processAsaasWebhookEventMessage", () => {
  beforeEach(() => {
    process.mockReset()
    markProcessed.mockReset()
    markFailed.mockReset()
    process.mockResolvedValue(undefined)
    markProcessed.mockResolvedValue(undefined)
    markFailed.mockResolvedValue(undefined)
  })

  it("payload válido: processa e marca como processado", async () => {
    const message = baseMessage()
    await processAsaasWebhookEventMessage(message, metadata, deps)

    expect(process).toHaveBeenCalledTimes(1)
    expect(process).toHaveBeenCalledWith(message.body)
    expect(markProcessed).toHaveBeenCalledTimes(1)
    expect(markProcessed).toHaveBeenCalledWith("evt-1")
    expect(markFailed).not.toHaveBeenCalled()
  })

  it("payload sem eventId: ack sem chamar process", async () => {
    await processAsaasWebhookEventMessage(
      { ...baseMessage(), eventId: "" },
      metadata,
      deps
    )
    expect(process).not.toHaveBeenCalled()
    expect(markProcessed).not.toHaveBeenCalled()
    expect(markFailed).not.toHaveBeenCalled()
  })

  it("payload sem body: ack sem chamar process", async () => {
    await processAsaasWebhookEventMessage(
      { eventId: "evt-1" } as AsaasWebhookEventPayload,
      metadata,
      deps
    )
    expect(process).not.toHaveBeenCalled()
    expect(markProcessed).not.toHaveBeenCalled()
    expect(markFailed).not.toHaveBeenCalled()
  })

  /**
   * T-Q3.2 + review #1042. Payload malformado é falha **terminal**: se entrasse
   * como `pending`, o cron de retry republicaria o mesmo payload e o ciclo
   * fila↔outbox não fecharia nunca. O `reason` nomeia o campo que faltou.
   */
  it("T-Q3.2 — payload inválido grava dead-letter TERMINAL nomeando o campo, e acka", async () => {
    recordTerminalFailure.mockClear()
    upsertFromProcessingFailure.mockClear()

    await expect(
      processAsaasWebhookEventMessage(
        { eventId: "evt-1" } as AsaasWebhookEventPayload,
        metadata,
        deps,
      ),
    ).resolves.toBeUndefined()

    expect(process).not.toHaveBeenCalled()
    expect(upsertFromProcessingFailure).not.toHaveBeenCalled()
    expect(recordTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "asaas-webhook-events",
        idempotencyKey: "evt-1",
        lastError: "campos obrigatórios ausentes: body",
      }),
    )
  })

  it("T-Q3.2 — sem chave no payload, a linha usa o messageId como idempotencyKey", async () => {
    recordTerminalFailure.mockClear()

    await processAsaasWebhookEventMessage({} as AsaasWebhookEventPayload, metadata, deps)

    expect(recordTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "invalid-payload:msg-1" }),
    )
  })

  it("process lança: marca failed sem 3º argumento e propaga throw para retry", async () => {
    process.mockRejectedValueOnce(new Error("persist failed"))

    await expect(
      processAsaasWebhookEventMessage(baseMessage(), metadata, deps)
    ).rejects.toThrow("persist failed")

    expect(process).toHaveBeenCalledTimes(1)
    expect(markProcessed).not.toHaveBeenCalled()
    expect(markFailed).toHaveBeenCalledTimes(1)
    expect(markFailed).toHaveBeenCalledWith("evt-1", "persist failed")
    expect(markFailed.mock.calls[0]?.length).toBe(2)
  })

  it("deliveryCount excedeu o limite: helper acka após markFailed (cron Asaas segue)", async () => {
    const ackDeadLetter = mock(async () => true)
    process.mockRejectedValueOnce(new Error("persist failed"))

    await expect(
      processAsaasWebhookEventMessage(baseMessage(), { ...metadata, deliveryCount: 20 }, {
        ...deps,
        ackDeadLetter,
      }),
    ).resolves.toBeUndefined()

    expect(markFailed).toHaveBeenCalledWith("evt-1", "persist failed")
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "asaas-webhook-events",
        idempotencyKey: "evt-1",
        deliveryCount: 20,
      }),
    )
  })

  it("markFailed também falha: ainda propaga o erro original de process", async () => {
    const processError = new Error("persist failed")
    process.mockRejectedValueOnce(processError)
    markFailed.mockRejectedValueOnce(new Error("db down"))

    await expect(
      processAsaasWebhookEventMessage(baseMessage(), metadata, deps)
    ).rejects.toBe(processError)

    expect(markFailed).toHaveBeenCalledTimes(1)
    expect(markProcessed).not.toHaveBeenCalled()
  })
})
