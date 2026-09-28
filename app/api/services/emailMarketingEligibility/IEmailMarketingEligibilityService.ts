import type { EmailEligibilityDecision, EmailEligibilityFlags } from "@/lib/email/email-marketing-eligibility"

export type { EmailEligibilityDecision, EmailEligibilityFlags }

export interface IEmailMarketingEligibilityService {
  decide(flags: EmailEligibilityFlags): EmailEligibilityDecision
  filter<T extends { email: string }>(rows: T[], blockedEmails: Set<string>, flagsByEmail?: Map<string, EmailEligibilityFlags>): T[]
}
