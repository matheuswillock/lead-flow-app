import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { EmailCampaignDispatchWakePayload } from "@/lib/queues/email-campaign-dispatch"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

// Só o cliente da Vercel é stubado: `processDispatchMessage` usa o builder de
// idempotência de verdade, senão a chave assertada aqui divergiria em silêncio
// da que roda em produção.
mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = mock(async () => ({ messageId: "mid-test" }))
    handleCallback = (handler: unknown) => handler
  },
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

const { processEmailCampaignDispatchMessage } = await import("./processDispatchMessage")

const processDispatchQueueBatch = mock(async () => new Output(true, [], [], { hasMore: false }))

const baseMessage = (): EmailCampaignDispatchWakePayload => ({
  dispatchId: "dispatch-1",
  reason: "start",
})

const metadata: QueueMessageMetadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "email-campaign-dispatch",
  region: "gru1",
}

describe("processEmailCampaignDispatchMessage", () => {
  beforeEach(() => {
    processDispatchQueueBatch.mockReset()
    processDispatchQueueBatch.mockResolvedValue(new Output(true, [], [], { hasMore: false }))
  })

  it("chama processDispatchQueueBatch com o dispatchId", async () => {
    await processEmailCampaignDispatchMessage(baseMessage(), metadata, {
      processDispatchQueueBatch,
    })
    expect(processDispatchQueueBatch).toHaveBeenCalledWith("dispatch-1")
  })

  it("propaga erro para retry quando o use case lança", async () => {
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(baseMessage(), metadata, {
        processDispatchQueueBatch,
      }),
    ).rejects.toThrow("P2024")
  })

  /**
   * T-Q3.2 + review #1042. Payload malformado é falha **terminal**: se entrasse
   * como `pending`, o cron de retry republicaria o mesmo payload e o ciclo
   * fila↔outbox não fecharia nunca. Sem `dispatchId` no payload, a chave cai no
   * `messageId` para que reentregas colapsem na mesma linha.
   */
  it("T-Q3.2 — payload inválido grava dead-letter TERMINAL nomeando o campo, e acka", async () => {
    recordTerminalFailure.mockClear()
    upsertFromProcessingFailure.mockClear()

    await expect(
      processEmailCampaignDispatchMessage(
        { reason: "start" } as EmailCampaignDispatchWakePayload,
        metadata,
        { processDispatchQueueBatch },
      ),
    ).resolves.toBeUndefined()

    expect(processDispatchQueueBatch).not.toHaveBeenCalled()
    expect(upsertFromProcessingFailure).not.toHaveBeenCalled()
    expect(recordTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch",
        idempotencyKey: "invalid-payload:msg-1",
        lastError: "campos obrigatórios ausentes: dispatchId",
      }),
    )
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { processDispatchQueueBatch },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch",
        idempotencyKey: "dispatch-1:start",
        deliveryCount: 20,
      }),
    )
  })

  it("overflow: dead-letter usa o tópico overflow", async () => {
    const ackDeadLetter = mock(async () => true)
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20, topicName: "email-campaign-dispatch-overflow" },
        { processDispatchQueueBatch },
        ackDeadLetter,
        "email-campaign-dispatch-overflow",
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch-overflow",
        deliveryCount: 20,
      }),
    )
  })
})
