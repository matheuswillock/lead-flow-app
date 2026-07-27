/** Absolute max session lifetime from last sign-in. */
export const MAX_AUTH_SESSION_MS = 6 * 60 * 60 * 1000

export const MAX_AUTH_SESSION_LABEL = "6 horas"

/**
 * Returns true when the session started more than {@link MAX_AUTH_SESSION_MS} ago.
 * Uses `last_sign_in_at` (updated on sign-in, not on token refresh).
 */
export function isAuthSessionExpired(
  lastSignInAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!lastSignInAt) return false
  const startedAtMs = Date.parse(lastSignInAt)
  if (Number.isNaN(startedAtMs)) return false
  return nowMs - startedAtMs >= MAX_AUTH_SESSION_MS
}
