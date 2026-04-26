import { DEFAULT_TZ } from "./DEFAULT_TZ"

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function resolveTimezone(tz: string | null | undefined): string {
  if (tz && isValidTimezone(tz)) return tz
  return DEFAULT_TZ
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ
  } catch {
    return DEFAULT_TZ
  }
}
