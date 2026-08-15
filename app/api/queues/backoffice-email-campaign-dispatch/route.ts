import { BackofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import {
  handleBackofficeEmailCampaignDispatchCallback,
  type BackofficeEmailCampaignDispatchWakePayload,
} from "@/lib/queues/backoffice-email-campaign-dispatch"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

function makeUseCase() {
  return new BackofficeEmailCampaignUseCase()
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 1 — ver
 * comentário em `vercel.json`) da fila `backoffice-email-campaign-dispatch`.
 *
 * Processa **um lote** de destinatários `queued` do dispatch (não a campanha
 * inteira) e deixa `BackofficeEmailCampaignUseCase.processDispatchQueueBatch`
 * republicar o wake quando sobrar mais — mesmo padrão do consumer do produto
 * (`app/api/queues/email-campaign-dispatch/route.ts`), fila própria por
 * isolamento de módulo (backoffice não compartilha infra com produto).
 */
export async function processBackofficeEmailCampaignDispatchMessage(
  message: BackofficeEmailCampaignDispatchWakePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<BackofficeEmailCampaignUseCase, "processDispatchQueueBatch"> = makeUseCase()
): Promise<void> {
  console.info("[BackofficeEmailCampaignDispatchQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    dispatchId: message?.dispatchId,
    reason: message?.reason,
  })

  if (!message?.dispatchId) {
    console.error("[BackofficeEmailCampaignDispatchQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const output = await useCase.processDispatchQueueBatch(message.dispatchId)
    console.info("[BackofficeEmailCampaignDispatchQueueRoute][POST] batch processed", {
      messageId: metadata.messageId,
      dispatchId: message.dispatchId,
      isValid: output.isValid,
      result: output.result,
    })
  } catch (error) {
    console.error("[BackofficeEmailCampaignDispatchQueueRoute][POST] handle failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      dispatchId: message.dispatchId,
      error,
    })
    throw error
  }
}

export const POST = handleBackofficeEmailCampaignDispatchCallback(
  (message: BackofficeEmailCampaignDispatchWakePayload, metadata: QueueMessageMetadata) =>
    processBackofficeEmailCampaignDispatchMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(30 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
