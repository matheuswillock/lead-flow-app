import Papa from "papaparse"
import { z } from "zod"
import type {
  IBackofficeEmailContactImportService,
  ParseBackofficeContactSourceResult,
  ParsedBackofficeContactRow,
} from "./IBackofficeEmailContactImportService"

const emailSchema = z.string().trim().email()

function normalizeRow(raw: Record<string, unknown>): ParsedBackofficeContactRow | null {
  const emailRaw = raw.email ?? raw.Email ?? raw.EMAIL
  const nameRaw = raw.name ?? raw.Name ?? raw.NAME

  const emailParse = emailSchema.safeParse(emailRaw)
  if (!emailParse.success) return null

  const { email: _email, name: _name, Email: _e2, Name: _n2, EMAIL: _e3, NAME: _n3, ...rest } = raw

  return {
    email: emailParse.data.toLowerCase(),
    name: typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null,
    customFields: Object.keys(rest).length > 0 ? rest : null,
  }
}

export class BackofficeEmailContactImportService implements IBackofficeEmailContactImportService {
  parseCsv(content: string): ParseBackofficeContactSourceResult {
    const parsed = Papa.parse<Record<string, unknown>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    const rows: ParsedBackofficeContactRow[] = []
    let skippedCount = 0

    for (const raw of parsed.data) {
      const row = normalizeRow(raw)
      if (row) {
        rows.push(row)
      } else {
        skippedCount += 1
      }
    }

    return { rows, skippedCount }
  }

  parseJson(content: string): ParseBackofficeContactSourceResult {
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch {
      return { rows: [], skippedCount: 0 }
    }

    const items = Array.isArray(data) ? data : []
    const rows: ParsedBackofficeContactRow[] = []
    let skippedCount = 0

    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        skippedCount += 1
        continue
      }
      const row = normalizeRow(item as Record<string, unknown>)
      if (row) {
        rows.push(row)
      } else {
        skippedCount += 1
      }
    }

    return { rows, skippedCount }
  }
}

export const backofficeEmailContactImportService = new BackofficeEmailContactImportService()
