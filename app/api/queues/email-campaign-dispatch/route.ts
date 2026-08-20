import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import {
  buildEmailCampaignDispatchIdempotencyKey,
  handleEmailCampaignDispatchCallback,
  EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  type EmailCampaignDispatchWakePayload,
} from "@/lib/queues/email-campaign-dispatch"
import {
  ackAfterMaxDeliveries,
  type AckAfterMaxDeliveriesFn,
} from "@/lib/queues/queue-processing-failure"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

function makeUseCase() {
  return new EmailCampaignUseCase()
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 1 — ver
 * comentário em `vercel.json`) da fila `email-campaign-dispatch`.
 *
 * Processa **um lote** de destinatários `queued` do dispatch (não a campanha
 * inteira) e deixa `EmailCampaignUseCase.processDispatchQueueBatch` republicar
 * o wake quando sobrar mais — isso é o que tira o envio via Resend do isolate
 * síncrono de 60s do cron / `after()` do `/send` (Fase 4 / PR1).
 */
export async function processEmailCampaignDispatchMessage(
  message: EmailCampaignDispatchWakePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<EmailCampaignUseCase, "processDispatchQueueBatch"> = makeUseCase(),
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
): Promise<void> {
  console.info("[EmailCampaignDispatchQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    dispatchId: message?.dispatchId,
    reason: message?.reason,
  })

  if (!message?.dispatchId) {
    console.error("[EmailCampaignDispatchQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const output = await useCase.processDispatchQueueBatch(message.dispatchId)
    console.info("[EmailCampaignDispatchQueueRoute][POST] batch processed", {
      messageId: metadata.messageId,
      dispatchId: message.dispatchId,
      isValid: output.isValid,
      result: output.result,
    })
  } catch (error) {
    console.error("[EmailCampaignDispatchQueueRoute][POST] handle failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      dispatchId: message.dispatchId,
      error,
    })
    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: EMAIL_CAMPAIGN_DISPATCH_TOPIC,
      idempotencyKey: buildEmailCampaignDispatchIdempotencyKey(message),
      payload: message,
      lastError: error,
    })
    if (acked) return
    throw error
  }
}

export const POST = handleEmailCampaignDispatchCallback(
  (message: EmailCampaignDispatchWakePayload, metadata: QueueMessageMetadata) =>
    processEmailCampaignDispatchMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(30 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
