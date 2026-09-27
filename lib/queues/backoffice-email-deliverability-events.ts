import { QueueClient } from "@vercel/queue"
import type { DeliverabilityEventV1 } from "@/lib/email/deliverability-event"

export const BACKOFFICE_EMAIL_DELIVERABILITY_EVENTS_TOPIC = "backoffice-email-deliverability-events"

const queue = new QueueClient({ region: "gru1" })

export async function publishBackofficeEmailDeliverabilityEvent(
  event: DeliverabilityEventV1
): Promise<{ messageId: string | null }> {
  return queue.send(BACKOFFICE_EMAIL_DELIVERABILITY_EVENTS_TOPIC, event, {
    idempotencyKey: event.eventKey,
    retentionSeconds: 60 * 60 * 24 * 7,
  })
}

export const { handleCallback: handleBackofficeEmailDeliverabilityEventsCallback } = queue
