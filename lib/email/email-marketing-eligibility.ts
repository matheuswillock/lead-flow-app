export type EmailEligibilityFlags = {
  isBlocked: boolean
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
}

export type EmailEligibilityDecision = {
  eligible: boolean
  reason: "blocked" | "complained" | "unsubscribed" | "bounced" | null
}

export function decideEmailMarketingEligibility(flags: EmailEligibilityFlags): EmailEligibilityDecision {
  if (flags.isBlocked) return { eligible: false, reason: "blocked" }
  if (flags.isComplained) return { eligible: false, reason: "complained" }
  if (flags.isUnsubscribed) return { eligible: false, reason: "unsubscribed" }
  if (flags.isBounced) return { eligible: false, reason: "bounced" }
  return { eligible: true, reason: null }
}

export function filterEmailMarketingEligibleRows<T extends { email: string }>(
  rows: T[],
  blockedEmails: Set<string>,
  flagsByEmail: Map<string, EmailEligibilityFlags> = new Map()
): T[] {
  return rows.filter((row) => {
    const normalizedEmail = row.email.trim().toLowerCase()
    const flags = flagsByEmail.get(normalizedEmail) ?? {
      isBlocked: blockedEmails.has(normalizedEmail),
      isComplained: false,
      isUnsubscribed: false,
      isBounced: false,
    }
    return decideEmailMarketingEligibility({
      ...flags,
      isBlocked: flags.isBlocked || blockedEmails.has(normalizedEmail),
    }).eligible
  })
}
