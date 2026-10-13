import { isActiveMemberProAssignment } from "@/app/api/shared/billing/memberProBillingRules"

const BLOCKED_STATUSES = new Set(["past_due", "suspended", "canceled"])

export type MemberProAccessRepairCandidate = {
  userTypeSlug: string
  accessStartsAt: Date | null
  accessExpiresAt: Date | null
  profileStatus: string | null
  profileSubscriptionStatus: string | null
  hasPermanentSubscription?: boolean
  profileSubscriptionHasPermanentSubscription?: boolean
  isBanned?: boolean
  now?: Date
}

export function shouldRepairMemberProAccess(input: MemberProAccessRepairCandidate): boolean {
  if (input.isBanned === true) return false
  if (input.hasPermanentSubscription === true || input.profileSubscriptionHasPermanentSubscription === true) return false

  const memberProActive = isActiveMemberProAssignment(
    {
      slug: input.userTypeSlug,
      accessStartsAt: input.accessStartsAt,
      accessExpiresAt: input.accessExpiresAt,
    },
    input.now
  )
  if (!memberProActive) return false

  return BLOCKED_STATUSES.has(input.profileStatus ?? "") ||
    BLOCKED_STATUSES.has(input.profileSubscriptionStatus ?? "")
}
