import {
  asaasWebhookEventRepository,
} from "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository"
import { processAsaasWebhookEvent } from "@/app/api/webhooks/asaas/processAsaasWebhookEvent"
import {
  ASAAS_WEBHOOK_EVENTS_TOPIC,
  handleAsaasWebhookEventsCallback,
  type AsaasWebhookEventPayload,
} from "@/lib/queues/asaas-webhook-events"
import {
  ackAfterMaxDeliveries,
  type AckAfterMaxDeliveriesFn,
} from "@/lib/queues/queue-processing-failure"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido ao processar webhook Asaas"
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 2).
 * Processa o evento completo do webhook Asaas fora do isolate HTTP do
 * webhook — o `after()` do webhook agora só publica nesta fila (PR2.2).
 * `claimForProcessing` já rodou antes do ack (dedupe síncrono), então este
 * consumer só chama a lógica de negócio e marca o resultado.
 */
export async function processAsaasWebhookEventMessage(
  message: AsaasWebhookEventPayload,
  metadata: QueueMessageMetadata,
  deps: {
    process: typeof processAsaasWebhookEvent
    markProcessed: typeof asaasWebhookEventRepository.markProcessed
    markFailed: typeof asaasWebhookEventRepository.markFailed
    ackDeadLetter?: AckAfterMaxDeliveriesFn
  } = {
    process: processAsaasWebhookEvent,
    markProcessed: asaasWebhookEventRepository.markProcessed.bind(asaasWebhookEventRepository),
    markFailed: asaasWebhookEventRepository.markFailed.bind(asaasWebhookEventRepository),
  }
): Promise<void> {
  console.info("[AsaasWebhookEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    region: metadata.region,
    eventId: message?.eventId,
    event: message?.body?.event,
  })

  if (!message?.eventId || !message?.body) {
    console.error("[AsaasWebhookEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    await deps.process(message.body)
    await deps.markProcessed(message.eventId)
    console.info("[AsaasWebhookEventsQueueRoute][POST] event processed", {
      messageId: metadata.messageId,
      eventId: message.eventId,
    })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    console.error("[AsaasWebhookEventsQueueRoute][POST] processing failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      eventId: message.eventId,
      error,
    })
    await deps.markFailed(message.eventId, errorMessage).catch((markError) => {
      console.error("[AsaasWebhookEventsQueueRoute][POST] failed to mark event as failed", {
        eventId: message.eventId,
        markError,
      })
    })
    const ackDeadLetter = deps.ackDeadLetter ?? ackAfterMaxDeliveries
    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: ASAAS_WEBHOOK_EVENTS_TOPIC,
      idempotencyKey: message.eventId,
      payload: message,
      lastError: error,
    })
    if (acked) return
    throw error
  }
}

export const POST = handleAsaasWebhookEventsCallback(
  (message: AsaasWebhookEventPayload, metadata: QueueMessageMetadata) =>
    processAsaasWebhookEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
