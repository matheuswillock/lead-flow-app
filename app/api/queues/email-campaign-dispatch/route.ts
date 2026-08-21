import {
  handleEmailCampaignDispatchCallback,
  type EmailCampaignDispatchWakePayload,
} from "@/lib/queues/email-campaign-dispatch"
import { processEmailCampaignDispatchMessage } from "./processDispatchMessage"

export const maxDuration = 300

export { processEmailCampaignDispatchMessage }

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
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
