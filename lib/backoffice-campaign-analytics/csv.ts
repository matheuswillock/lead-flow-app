const BOM = "﻿"
const SEPARATOR = ";"

function escapeCell(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// DA4/D5 (SPEC 10): UTF-8 com BOM, separador ";", decimal com vírgula, header PT-BR.
export function buildCampaignAnalyticsCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((line) => line.map(escapeCell).join(SEPARATOR))
  return BOM + lines.join("\r\n") + "\r\n"
}

export function formatCsvInteger(value: number): string {
  return String(Math.round(value))
}

export function formatCsvRate(value: number | null): string {
  if (value === null) return ""
  return `${(value * 100).toFixed(1).replace(".", ",")}%`
}

export function formatCsvDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
