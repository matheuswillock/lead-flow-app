import JSZip from "jszip"
import Papa from "papaparse"

import type { ExportTable } from "@/app/api/shared/teamDeletion/teamDeletionTypes"

export type { ExportTable }

const BOM = "﻿"
/** Telefones e números negativos começam com + ou - e não são fórmula. */
const PLAIN_SIGNED_NUMBER = /^[+-][\d\s().,-]+$/

/**
 * Texto digitado por usuários não pode virar fórmula ao abrir a planilha (injeção de fórmula):
 * valores que começam com = ou @ (e + ou - seguidos de texto) ganham um apóstrofo.
 */
function guardFormula(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !PLAIN_SIGNED_NUMBER.test(value)) return `'${value}`
  return value
}

function normalizeCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "object") return guardFormula(JSON.stringify(value))
  return guardFormula(String(value))
}

/** CSV em UTF-8 com BOM (o Excel abre os acentos certos). Colunas = união das chaves de todas as linhas. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return BOM
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  const data = rows.map((row) => columns.map((column) => normalizeCell(row[column])))
  return BOM + Papa.unparse({ fields: columns, data }, { newline: "\r\n" })
}

function formatDateBr(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getUTCFullYear()}`
}

function buildReadme(teamName: string, generatedAt: Date, counts: Record<string, number>): string {
  const lines = Object.entries(counts).map(
    ([fileName, count]) => `- ${fileName}: ${count} ${count === 1 ? "linha" : "linhas"}`,
  )
  return [
    `Exportação do time "${teamName}"`,
    `Gerada em ${formatDateBr(generatedAt)} pelo Corretor Studio.`,
    "",
    "Conteúdo (uma planilha por área, em CSV com acentos em UTF-8):",
    ...lines,
    "",
    "ATENÇÃO: este arquivo contém dados pessoais de terceiros (como leads e clientes), e alguns campos",
    "podem ser dados sensíveis, como informações de saúde. Pela LGPD (Lei nº 13.709/2018), o cliente é o",
    "Controlador desses dados e responde pela guarda e pelo uso deste arquivo. Guarde em local seguro,",
    "não compartilhe sem necessidade e apague quando não precisar mais.",
    "",
    "Os anexos e contratos em si não estão neste arquivo; a lista deles (nome, tipo e data) está em anexos.csv.",
    "O conteúdo das mensagens de WhatsApp não é exportado.",
    "",
  ].join("\r\n")
}

export async function buildTeamExportZip(input: {
  teamName: string
  generatedAt: Date
  tables: ExportTable[]
}): Promise<{ zip: Uint8Array; counts: Record<string, number> }> {
  const zip = new JSZip()
  const counts: Record<string, number> = {}

  for (const table of input.tables) {
    counts[table.fileName] = table.rows.length
    zip.file(table.fileName, toCsv(table.rows))
  }
  zip.file("LEIA-ME.txt", buildReadme(input.teamName, input.generatedAt, counts))

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  })
  return { zip: bytes, counts }
}
