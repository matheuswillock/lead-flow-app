import { createHash } from "node:crypto"
import type { EmailEventType } from "@prisma/client"
import { publishBackofficeEmailDeliverabilityEvent } from "@/lib/queues/backoffice-email-deliverability-events"
import type { DeliverabilityEventV1 } from "@/lib/email/deliverability-event"

const eventTypeMap: Partial<Record<EmailEventType, DeliverabilityEventV1["type"]>> = {
  delivered: "delivered",
  bounced: "hard_bounced",
  complained: "complained",
  opened: "human_opened",
  clicked: "clicked",
  suppressed: "suppressed",
}

function resolveBounceType(metadata: Record<string, unknown> | undefined): DeliverabilityEventV1["type"] {
  const bounceType = String(metadata?.bounceType ?? "").toLowerCase()
  return bounceType.includes("soft") || bounceType.includes("temporary")
    ? "soft_bounced"
    : "hard_bounced"
}

export function buildDeliverabilityEvent(input: {
  logId: string
  teamId: string
  occurredAt: Date
  eventType: EmailEventType
  senderDomain: string
  recipientEmail: string
  teamName?: string | null
  metadata?: Record<string, unknown>
}): DeliverabilityEventV1 | null {
  const type = input.eventType === "bounced"
    ? resolveBounceType(input.metadata)
    : eventTypeMap[input.eventType]
  if (!type) return null
  const eventKey = createHash("sha256")
    .update([input.logId, input.eventType, input.occurredAt.toISOString()].join(":"))
    .digest("hex")
  return {
    version: 1,
    eventKey,
    teamId: input.teamId,
    teamName: input.teamName ?? null,
    senderDomain: input.senderDomain || "unknown",
    recipientProvider: input.recipientEmail.split("@")[1]?.toLowerCase() ?? "unknown",
    occurredAt: input.occurredAt,
    type,
  }
}

export class EmailDeliverabilityEventPublisher {
  async publish(event: DeliverabilityEventV1): Promise<{ messageId: string | null }> {
    return publishBackofficeEmailDeliverabilityEvent(event)
  }
}

export const emailDeliverabilityEventPublisher = new EmailDeliverabilityEventPublisher()
