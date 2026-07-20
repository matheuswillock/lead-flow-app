const MEMBER_PRO_MIN_DAYS = 1
const MEMBER_PRO_MAX_DAYS = 365
const MEMBER_PRO_DAY_MS = 24 * 60 * 60 * 1000

function remainingAccessDays(accessExpiresAt: string | null): number | null {
  if (!accessExpiresAt) return null
  const ms = new Date(accessExpiresAt).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.min(
    MEMBER_PRO_MAX_DAYS,
    Math.max(MEMBER_PRO_MIN_DAYS, Math.ceil(ms / MEMBER_PRO_DAY_MS))
  )
}

function suggestedMemberProAccessDays(accessExpiresAt: string | null): number {
  return remainingAccessDays(accessExpiresAt) ?? MEMBER_PRO_MAX_DAYS
}

function memberProExpiresAtFromDays(days: number): string {
  return new Date(Date.now() + days * MEMBER_PRO_DAY_MS).toISOString()
}

export {
  MEMBER_PRO_DAY_MS,
  MEMBER_PRO_MAX_DAYS,
  MEMBER_PRO_MIN_DAYS,
  memberProExpiresAtFromDays,
  remainingAccessDays,
  suggestedMemberProAccessDays,
}
