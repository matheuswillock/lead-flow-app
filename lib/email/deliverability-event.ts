export type DeliverabilityEventV1 = {
  version: 1
  eventKey: string
  teamId: string
  teamName: string | null
  occurredAt: Date
  senderDomain: string
  recipientProvider: string
  type: "sent" | "delivered" | "hard_bounced" | "soft_bounced" | "complained" | "human_opened" | "clicked" | "suppressed"
}
