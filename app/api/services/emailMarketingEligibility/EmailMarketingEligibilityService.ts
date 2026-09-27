import type {
  EmailEligibilityFlags,
  EmailEligibilityDecision,
  IEmailMarketingEligibilityService,
} from "./IEmailMarketingEligibilityService"

export class EmailMarketingEligibilityService implements IEmailMarketingEligibilityService {
  decide(flags: EmailEligibilityFlags): EmailEligibilityDecision {
    if (flags.isBlocked) return { eligible: false, reason: "blocked" }
    if (flags.isComplained) return { eligible: false, reason: "complained" }
    if (flags.isUnsubscribed) return { eligible: false, reason: "unsubscribed" }
    if (flags.isBounced) return { eligible: false, reason: "bounced" }
    return { eligible: true, reason: null }
  }

  filter<T extends { email: string }>(rows: T[], blockedEmails: Set<string>, flagsByEmail = new Map()): T[] {
    return rows.filter((row) => {
      const normalizedEmail = row.email.trim().toLowerCase()
      const flags = flagsByEmail.get(normalizedEmail) ?? {
        isBlocked: blockedEmails.has(normalizedEmail),
        isComplained: false,
        isUnsubscribed: false,
        isBounced: false,
      }
      return this.decide({ ...flags, isBlocked: flags.isBlocked || blockedEmails.has(normalizedEmail) }).eligible
    })
  }
}

export const emailMarketingEligibilityService = new EmailMarketingEligibilityService()
