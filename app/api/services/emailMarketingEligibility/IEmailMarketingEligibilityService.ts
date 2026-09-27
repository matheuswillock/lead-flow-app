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

export interface IEmailMarketingEligibilityService {
  decide(flags: EmailEligibilityFlags): EmailEligibilityDecision
  filter<T extends { email: string }>(rows: T[], blockedEmails: Set<string>, flagsByEmail?: Map<string, EmailEligibilityFlags>): T[]
}
