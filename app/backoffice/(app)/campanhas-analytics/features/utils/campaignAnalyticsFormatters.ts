// Só formatação de exibição — nenhum cálculo de métrica aqui (todos os números
// já vêm prontos do backend, ver Non-goals da SPEC 11).

const INTEGER_FORMATTER = new Intl.NumberFormat("pt-BR")

export function formatCampaignAnalyticsInteger(value: number): string {
  return INTEGER_FORMATTER.format(Math.round(value))
}

/** Fração 0–1 vira "12,6%"; `null` (divisor zero no backend) vira "—", nunca "0%". */
export function formatCampaignAnalyticsRate(value: number | null): string {
  if (value === null) return "—"
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** `finalScore` = leads por 1.000 enviados; `null` vira "—". */
export function formatCampaignAnalyticsScore(value: number | null): string {
  if (value === null) return "—"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatCampaignAnalyticsDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
}

export function formatCampaignAnalyticsDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return day
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date)
}
