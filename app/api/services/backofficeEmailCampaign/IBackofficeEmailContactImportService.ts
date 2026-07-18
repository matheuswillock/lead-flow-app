export interface ParsedBackofficeContactRow {
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
}

export interface ParseBackofficeContactSourceResult {
  rows: ParsedBackofficeContactRow[]
  skippedCount: number
}

export interface IBackofficeEmailContactImportService {
  parseCsv(content: string): ParseBackofficeContactSourceResult
  parseJson(content: string): ParseBackofficeContactSourceResult
}
