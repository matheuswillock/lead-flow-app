const INTERNAL_ORIGIN = "https://bethania-return.invalid"
const MAX_RETURN_PATH_LENGTH = 2_048
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ENCODED_SEPARATOR_PATTERN = /%(?:2f|5c)/i

export function resolveBethaniaSafeReturnPath(
  candidate: string | null | undefined,
  supabaseId: string,
): string | null {
  if (
    !candidate ||
    !UUID_PATTERN.test(supabaseId) ||
    candidate.length > MAX_RETURN_PATH_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate) ||
    ENCODED_SEPARATOR_PATTERN.test(candidate)
  ) {
    return null
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN)
    const profilePath = `/${supabaseId}/`
    if (
      parsed.origin !== INTERNAL_ORIGIN ||
      !parsed.pathname.startsWith(profilePath) ||
      parsed.pathname.includes("//")
    ) {
      return null
    }

    return parsed.pathname
  } catch {
    return null
  }
}
