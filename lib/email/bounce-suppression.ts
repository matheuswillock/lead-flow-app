export const MAILBOX_FULL_BOUNCE_SUBTYPE = "MailboxFull"
export const CONTENT_REJECTED_BOUNCE_SUBTYPE = "ContentRejected"

export type BounceSuppressionInput = {
  type?: string | null
  subType?: string | null
  message?: string | null
}

export function isMailboxFullBounce(input: BounceSuppressionInput): boolean {
  if (input.subType === MAILBOX_FULL_BOUNCE_SUBTYPE) return true
  return (input.message ?? "").toLowerCase().includes("inbox was full")
}

/** Stamp global de isBounced: qualquer bounce, exceto caixa cheia. */
export function shouldSuppressContactOnBounce(input: BounceSuppressionInput): boolean {
  return !isMailboxFullBounce(input)
}

export function shouldStampIsBouncedFromEventMetadata(
  metadata: Record<string, unknown>
): boolean {
  return shouldSuppressContactOnBounce({
    type: typeof metadata.bounceType === "string" ? metadata.bounceType : null,
    subType: typeof metadata.bounceSubType === "string" ? metadata.bounceSubType : null,
    message: typeof metadata.bounceMessage === "string" ? metadata.bounceMessage : null,
  })
}
