/** Absolute max lifetime of a single auth session (per session_id). */
export const MAX_AUTH_SESSION_MS = 6 * 60 * 60 * 1000

export const MAX_AUTH_SESSION_LABEL = "6 horas"

export const AUTH_SESSION_BOUND_COOKIE = "lf_auth_session_bound"

/**
 * Returns true when the session started more than {@link MAX_AUTH_SESSION_MS} ago.
 * `startedAtMs` must be the start of the *current* session (not account last_sign_in_at).
 */
export function isAuthSessionExpired(
  startedAtMs: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return false
  return nowMs - startedAtMs >= MAX_AUTH_SESSION_MS
}

export function parseAuthSessionBoundCookie(
  value: string | undefined
): { sessionId: string; startedAtMs: number } | null {
  if (!value) return null
  const separator = value.indexOf("|")
  if (separator <= 0) return null
  const sessionId = value.slice(0, separator)
  const startedAtMs = Number(value.slice(separator + 1))
  if (!sessionId || !Number.isFinite(startedAtMs)) return null
  return { sessionId, startedAtMs }
}

export function formatAuthSessionBoundCookie(sessionId: string, startedAtMs: number): string {
  return `${sessionId}|${startedAtMs}`
}

/** Extract Supabase Auth `session_id` claim from a JWT access token. */
export function extractSupabaseSessionId(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null
  const parts = accessToken.split(".")
  if (parts.length < 2 || !parts[1]) return null

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8")
    const payload = JSON.parse(json) as { session_id?: unknown }
    return typeof payload.session_id === "string" && payload.session_id.length > 0
      ? payload.session_id
      : null
  } catch {
    return null
  }
}

/**
 * Resolve the absolute start timestamp for the current session.
 * Keeps the previous stamp when the cookie matches this session_id; otherwise starts a new lease.
 */
export function resolveAuthSessionStartedAt(input: {
  sessionId: string
  bound: { sessionId: string; startedAtMs: number } | null
  nowMs?: number
}): number {
  const nowMs = input.nowMs ?? Date.now()
  if (input.bound && input.bound.sessionId === input.sessionId) {
    return input.bound.startedAtMs
  }
  return nowMs
}
