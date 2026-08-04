import Papa from "papaparse"
import * as XLSX from "xlsx"
import { LEAD_IMPORT_MAX_ROWS } from "@/lib/leadImport/leadImportFields"

/** Cap de linhas por export — mesma constante do CRM (`LEAD_IMPORT_MAX_ROWS`). */
export const RADAR_EXPORT_MAX_ROWS = LEAD_IMPORT_MAX_ROWS

export type RadarExportFormat = "csv" | "excel"

export type RadarExportIdentity = {
  type: string
  value: string | null
  normalizedValue: string
}

export type RadarExportProfileInput = {
  displayName: string
  primaryEmail: string | null
  displayPhone: string | null
  primaryDocument: string | null
  lastSeenAt: Date | string | null
  identities: RadarExportIdentity[]
  lastEvent?: {
    eventType: string
    occurredAt: Date | string
  } | null
}

export type RadarExportRow = {
  Perfil: string
  "E-mail": string
  Telefone: string
  Documento: string
  Identidades: string
  "Último evento": string
  "Data do último evento": string
  "Última interação": string
}

export type RadarExportFilePayload = {
  fileName: string
  content: string | ArrayBuffer
  contentType: string
}

export const RADAR_EXPORT_COLUMNS: Array<keyof RadarExportRow> = [
  "Perfil",
  "E-mail",
  "Telefone",
  "Documento",
  "Identidades",
  "Último evento",
  "Data do último evento",
  "Última interação",
]

function toIsoOrEmpty(value: Date | string | null | undefined): string {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString()
  return value
}

export function formatRadarExportIdentities(identities: RadarExportIdentity[]): string {
  return identities
    .map((identity) => {
      const value = identity.value?.trim() || identity.normalizedValue
      return `${identity.type}:${value}`
    })
    .join("; ")
}

export function buildRadarExportRows(profiles: RadarExportProfileInput[]): RadarExportRow[] {
  return profiles.map((profile) => ({
    Perfil: profile.displayName ?? "",
    "E-mail": profile.primaryEmail ?? "",
    Telefone: profile.displayPhone ?? "",
    Documento: profile.primaryDocument ?? "",
    Identidades: formatRadarExportIdentities(profile.identities ?? []),
    "Último evento": profile.lastEvent?.eventType ?? "",
    "Data do último evento": toIsoOrEmpty(profile.lastEvent?.occurredAt),
    "Última interação": toIsoOrEmpty(profile.lastSeenAt),
  }))
}

export function capRadarExportRows<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  if (rows.length <= RADAR_EXPORT_MAX_ROWS) {
    return { rows, truncated: false }
  }
  return { rows: rows.slice(0, RADAR_EXPORT_MAX_ROWS), truncated: true }
}

/** Prefixa celulas que Excel/LibreOffice interpretariam como formula. */
export function escapeRadarExportFormulaCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`
  }
  return value
}

function escapeRadarExportRowFormulas(row: RadarExportRow): RadarExportRow {
  return {
    Perfil: escapeRadarExportFormulaCell(row.Perfil),
    "E-mail": escapeRadarExportFormulaCell(row["E-mail"]),
    Telefone: escapeRadarExportFormulaCell(row.Telefone),
    Documento: escapeRadarExportFormulaCell(row.Documento),
    Identidades: escapeRadarExportFormulaCell(row.Identidades),
    "Último evento": escapeRadarExportFormulaCell(row["Último evento"]),
    "Data do último evento": escapeRadarExportFormulaCell(row["Data do último evento"]),
    "Última interação": escapeRadarExportFormulaCell(row["Última interação"]),
  }
}

export function buildRadarExportCsv(
  rows: RadarExportRow[],
  fileNameBase = "radar-perfis"
): RadarExportFilePayload {
  return {
    fileName: `${fileNameBase}.csv`,
    content: `\uFEFF${Papa.unparse(rows, {
      columns: RADAR_EXPORT_COLUMNS,
      escapeFormulae: true,
    })}`,
    contentType: "text/csv;charset=utf-8",
  }
}

export function buildRadarExportExcel(
  rows: RadarExportRow[],
  fileNameBase = "radar-perfis"
): RadarExportFilePayload {
  const safeRows = rows.map(escapeRadarExportRowFormulas)
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(safeRows, { header: [...RADAR_EXPORT_COLUMNS] })
  XLSX.utils.book_append_sheet(workbook, sheet, "Perfis")
  const excelArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  return {
    fileName: `${fileNameBase}.xlsx`,
    content: excelArray,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }
}

export function buildRadarExportFile(
  rows: RadarExportRow[],
  format: RadarExportFormat,
  fileNameBase = "radar-perfis"
): RadarExportFilePayload {
  if (format === "excel") {
    return buildRadarExportExcel(rows, fileNameBase)
  }
  return buildRadarExportCsv(rows, fileNameBase)
}
