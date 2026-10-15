const ANNUAL_CYCLES = new Set(["annual", "yearly"])
const ACTIVE_ANNUAL_STATUSES = new Set(["active", "trial"])

export type AnnualSubscriptionSnapshot = {
  subscriptionStatus?: string | null
  subscriptionCycle?: string | null
  subscriptionStartDate?: Date | null
  subscriptionEndDate?: Date | null
  subscriptionNextDueDate?: Date | null
}

export function isValidAnnualSubscription(
  subscription: AnnualSubscriptionSnapshot | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false

  const cycle = subscription.subscriptionCycle?.trim().toLowerCase()
  if (!cycle || !ANNUAL_CYCLES.has(cycle)) return false
  const status = subscription.subscriptionStatus?.trim().toLowerCase()
  if (!status || !ACTIVE_ANNUAL_STATUSES.has(status)) return false
  if (subscription.subscriptionStartDate && subscription.subscriptionStartDate.getTime() > now.getTime()) {
    return false
  }

  return [subscription.subscriptionEndDate, subscription.subscriptionNextDueDate].some(
    (date) => Boolean(date && date.getTime() > now.getTime()),
  )
}
