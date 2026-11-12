/** "quarta-feira, 11/11, às 14:00" no fuso do time. */
export function meetingLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
    .format(date)
    .replace(/, (\d{2}:\d{2})$/, ", às $1")
}

/** "em 10/12/2026": a data de vencimento não tem horário. */
export function planEndLabel(date: Date): string {
  return `em ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date)}`
}
