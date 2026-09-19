export interface ParsedContact {
  email: string
  name?: string
  customFields?: Record<string, string>
}

/** Contato do CSV com a linha REAL do arquivo (1 = cabeçalho, dados a partir de 2). */
export interface ParsedCsvContact extends ParsedContact {
  line: number
}

/** Linha do CSV que não pôde virar contato — reportada, nunca descartada em silêncio. */
export interface ParsedCsvIssue {
  line: number
  email: string
  reason: string
}

export interface ParsedCsvWithIssues {
  contacts: ParsedCsvContact[]
  issues: ParsedCsvIssue[]
}

export interface IEmailContactListService {
  parseCsv(csvContent: string): ParsedContact[]
  parseCsvWithIssues(csvContent: string): ParsedCsvWithIssues
}
