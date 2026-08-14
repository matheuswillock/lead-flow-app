import { resendWebhookUseCase, ResendWebhookUseCase } from "@/app/api/useCases/resendWebhook/ResendWebhookUseCase"
import {
  handleResendWebhookEmailLogEventsCallback,
  type ResendWebhookEmailLogEventPayload,
} from "@/lib/queues/resend-webhook-emaillog-events"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency configurado
 * em vercel.json). Processa o evento completo do webhook Resend
 * (ResendWebhookUseCase.handle) fora do isolate HTTP do webhook — o `after()`
 * do webhook agora só publica nesta fila (PR2.1).
 */
export async function processResendWebhookEmailLogEventMessage(
  message: ResendWebhookEmailLogEventPayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<ResendWebhookUseCase, "handle"> = resendWebhookUseCase
): Promise<void> {
  console.info("[ResendWebhookEmailLogEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    svixId: message?.svixId,
    eventType: message?.event?.type,
  })

  if (!message?.event || !message?.svixId) {
    console.error("[ResendWebhookEmailLogEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const output = await useCase.handle({ event: message.event, svixId: message.svixId })
    if (!output.isValid) {
      console.error("[ResendWebhookEmailLogEventsQueueRoute][POST] handle returned invalid Output, will retry", {
        messageId: metadata.messageId,
        deliveryCount: metadata.deliveryCount,
        svixId: message.svixId,
        errorMessages: output.errorMessages,
      })
      throw new Error(output.errorMessages.join("; ") || "ResendWebhookUseCase.handle retornou isValid=false")
    }
    console.info("[ResendWebhookEmailLogEventsQueueRoute][POST] event handled", {
      messageId: metadata.messageId,
      svixId: message.svixId,
      eventType: message.event.type,
    })
  } catch (error) {
    console.error("[ResendWebhookEmailLogEventsQueueRoute][POST] handle failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      svixId: message.svixId,
      error,
    })
    throw error
  }
}

export const POST = handleResendWebhookEmailLogEventsCallback(
  (message: ResendWebhookEmailLogEventPayload, metadata: QueueMessageMetadata) =>
    processResendWebhookEmailLogEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
