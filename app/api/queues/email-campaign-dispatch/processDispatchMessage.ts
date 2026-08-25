import type { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import {
  buildEmailCampaignDispatchIdempotencyKey,
  EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  type EmailCampaignDispatchWakePayload,
} from "@/lib/queues/email-campaign-dispatch"
import {
  ackAfterMaxDeliveries,
  buildInvalidPayloadIdempotencyKey,
  deadLetterInvalidPayload,
  describeMissingRequiredFields,
  listMissingRequiredFields,
  type AckAfterMaxDeliveriesFn,
  type DeadLetterInvalidPayloadFn,
} from "@/lib/queues/queue-processing-failure"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

async function makeUseCase(): Promise<Pick<EmailCampaignUseCase, "processDispatchQueueBatch">> {
  const { EmailCampaignUseCase: UseCase } = await import(
    "@/app/api/useCases/email/EmailCampaignUseCase"
  )
  return new UseCase()
}

/**
 * Processa **um lote** de destinatários `queued` do dispatch. Compartilhado
 * pela fila principal e pela overflow.
 */
export async function processEmailCampaignDispatchMessage(
  message: EmailCampaignDispatchWakePayload,
  metadata: QueueMessageMetadata,
  useCase?: Pick<EmailCampaignUseCase, "processDispatchQueueBatch">,
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
  topic: string = EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  deadLetter: DeadLetterInvalidPayloadFn = deadLetterInvalidPayload,
): Promise<void> {
  console.info("[EmailCampaignDispatchQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topic,
    dispatchId: message?.dispatchId,
    reason: message?.reason,
  })

  const missingFields = listMissingRequiredFields({ dispatchId: message?.dispatchId })
  if (missingFields.length > 0) {
    console.error("[EmailCampaignDispatchQueueRoute][POST] invalid payload, dead-letter e ack", {
      messageId: metadata.messageId,
      message,
      missingFields,
    })
    // Payload malformado não melhora com reentrega: vai direto para a
    // dead-letter terminal (fora do cron de retry) e só então acka.
    await deadLetter({
      topic,
      idempotencyKey: buildInvalidPayloadIdempotencyKey(message?.dispatchId, metadata.messageId),
      payload: message ?? null,
      reason: describeMissingRequiredFields(missingFields),
    })
    return
  }

  const processor = useCase ?? (await makeUseCase())

  try {
    const output = await processor.processDispatchQueueBatch(message.dispatchId)
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
      topic,
      idempotencyKey: buildEmailCampaignDispatchIdempotencyKey(message),
      payload: message,
      lastError: error,
    })
    if (acked) return
    throw error
  }
}
