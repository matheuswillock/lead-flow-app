import type {
  EmailEligibilityFlags,
  EmailEligibilityDecision,
  IEmailMarketingEligibilityService,
} from "./IEmailMarketingEligibilityService"
import { decideEmailMarketingEligibility, filterEmailMarketingEligibleRows } from "@/lib/email/email-marketing-eligibility"

export class EmailMarketingEligibilityService implements IEmailMarketingEligibilityService {
  decide(flags: EmailEligibilityFlags): EmailEligibilityDecision {
    return decideEmailMarketingEligibility(flags)
  }

  filter<T extends { email: string }>(rows: T[], blockedEmails: Set<string>, flagsByEmail = new Map()): T[] {
    return filterEmailMarketingEligibleRows(rows, blockedEmails, flagsByEmail)
  }
}

export const emailMarketingEligibilityService = new EmailMarketingEligibilityService()
