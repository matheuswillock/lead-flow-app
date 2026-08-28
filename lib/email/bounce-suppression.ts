export const MAILBOX_FULL_BOUNCE_SUBTYPE = "MailboxFull"
export const CONTENT_REJECTED_BOUNCE_SUBTYPE = "ContentRejected"
export const PERMANENT_BOUNCE_TYPE = "Permanent"

export type BounceSuppressionInput = {
  type?: string | null
  subType?: string | null
  message?: string | null
}

export function isMailboxFullBounce(input: BounceSuppressionInput): boolean {
  if (input.subType === MAILBOX_FULL_BOUNCE_SUBTYPE) return true
  return (input.message ?? "").toLowerCase().includes("inbox was full")
}

export function isPermanentBounce(input: BounceSuppressionInput): boolean {
  return (input.type ?? "").toLowerCase() === PERMANENT_BOUNCE_TYPE.toLowerCase()
}

/** Stamp global de isBounced: somente bounce Permanent. */
export function shouldSuppressContactOnBounce(input: BounceSuppressionInput): boolean {
  return isPermanentBounce(input)
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
