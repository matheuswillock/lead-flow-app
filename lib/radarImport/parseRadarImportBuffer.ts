import * as XLSX from "xlsx"
import Papa from "papaparse"

export type ParsedRadarImportRow = {
  line: number
  values: Record<string, string>
}

export type ParsedRadarImportFile = {
  columns: string[]
  rows: ParsedRadarImportRow[]
  sourceFormat: "csv" | "xlsx" | "json"
}

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0")
    const month = String(value.getMonth() + 1).padStart(2, "0")
    return `${day}/${month}/${value.getFullYear()}`
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  if (typeof value === "object") return ""
  return String(value).trim()
}

const buildRows = (columns: string[], matrix: unknown[][], firstLine: number): ParsedRadarImportRow[] =>
  matrix
    .map((cells, index) => {
      const values: Record<string, string> = {}
      columns.forEach((column, columnIndex) => {
        values[column] = toCellString(cells[columnIndex])
      })
      return { line: firstLine + index, values }
    })
    .filter((row) => Object.values(row.values).some((value) => value !== ""))

function parseXlsxBuffer(buffer: Buffer): ParsedRadarImportFile {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("A planilha está vazia")
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  })

  const headerRow = matrix[0] ?? []
  const columns = headerRow
    .map((cell) => toCellString(cell))
    .map((cell, index) => cell || `Coluna ${index + 1}`)

  if (columns.length === 0) {
    throw new Error("Não foi possível identificar as colunas da planilha")
  }

  return {
    columns,
    rows: buildRows(columns, matrix.slice(1), 2),
    sourceFormat: "xlsx",
  }
}

function parseCsvBuffer(text: string): ParsedRadarImportFile {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error("O arquivo CSV é inválido")
  }

  const matrix = result.data.filter((row) => Array.isArray(row)) as unknown[][]
  const headerRow = matrix[0] ?? []
  const columns = headerRow
    .map((cell) => toCellString(cell))
    .map((cell, index) => cell || `Coluna ${index + 1}`)

  if (columns.length === 0 || columns.every((column) => column.startsWith("Coluna "))) {
    throw new Error("Não foi possível identificar as colunas do CSV")
  }

  return {
    columns,
    rows: buildRows(columns, matrix.slice(1), 2),
    sourceFormat: "csv",
  }
}

function parseJsonBuffer(text: string): ParsedRadarImportFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("O arquivo JSON é inválido")
  }

  let items: unknown[] | null = null
  if (Array.isArray(data)) {
    items = data
  } else if (data && typeof data === "object") {
    const arrayValues = Object.values(data).filter((value) => Array.isArray(value))
    if (arrayValues.length === 1) {
      items = arrayValues[0] as unknown[]
    }
  }

  if (!items) {
    throw new Error("O JSON deve ser uma lista de objetos ou um objeto com uma única lista")
  }

  const objects = items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  )
  if (objects.length === 0) {
    throw new Error("Nenhum objeto foi encontrado no JSON")
  }

  const columnSet = new Set<string>()
  objects.forEach((item) => {
    Object.keys(item).forEach((key) => columnSet.add(key))
  })
  const columns = Array.from(columnSet)

  const rows = objects
    .map((item, index) => {
      const values: Record<string, string> = {}
      columns.forEach((column) => {
        values[column] = toCellString(item[column])
      })
      return { line: index + 1, values }
    })
    .filter((row) => Object.values(row.values).some((value) => value !== ""))

  return { columns, rows, sourceFormat: "json" }
}

export function parseRadarImportBuffer(
  buffer: Buffer,
  fileName: string
): ParsedRadarImportFile {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".xlsx")) {
    return parseXlsxBuffer(buffer)
  }
  if (lower.endsWith(".csv")) {
    return parseCsvBuffer(buffer.toString("utf-8"))
  }
  if (lower.endsWith(".json")) {
    return parseJsonBuffer(buffer.toString("utf-8"))
  }
  throw new Error("Formato não suportado. Envie um arquivo .xlsx, .csv ou .json")
}
