type QuietHoursConfig = {
  start?: string
  end?: string
  timezone?: string
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function getMinutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  return hour * 60 + minute
}

export function isWithinQuietHours(
  quietHours: unknown,
  now: Date = new Date(),
  fallbackTimezone = "America/Sao_Paulo"
): boolean {
  if (!quietHours || typeof quietHours !== "object") {
    return false
  }

  const config = quietHours as QuietHoursConfig
  if (!config.start || !config.end) {
    return false
  }

  const startMinutes = parseTimeToMinutes(config.start)
  const endMinutes = parseTimeToMinutes(config.end)
  if (startMinutes === null || endMinutes === null) {
    return false
  }

  const timezone = config.timezone?.trim() || fallbackTimezone
  const currentMinutes = getMinutesInTimezone(now, timezone)

  if (startMinutes === endMinutes) {
    return false
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}
