const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo"

function formatSaoPauloDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

export function isDueDateReachedInSaoPaulo(date: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false
  return date <= formatSaoPauloDate(now)
}
