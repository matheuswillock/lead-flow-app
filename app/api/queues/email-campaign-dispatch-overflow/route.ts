import {
  handleEmailCampaignDispatchOverflowCallback,
  EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC,
  type EmailCampaignDispatchWakePayload,
} from "@/lib/queues/email-campaign-dispatch"
import { processEmailCampaignDispatchMessage } from "@/app/api/queues/email-campaign-dispatch/processDispatchMessage"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer da fila overflow (`maxConcurrency: 1`): mesmo
 * `processDispatchQueueBatch` da fila principal. Disparos longos (>= 30 min)
 * saem dos 4 slots da principal sem falhar a campanha.
 */
export const POST = handleEmailCampaignDispatchOverflowCallback(
  (message: EmailCampaignDispatchWakePayload, metadata: QueueMessageMetadata) =>
    processEmailCampaignDispatchMessage(
      message,
      metadata,
      undefined,
      undefined,
      EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC,
    ),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(30 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
