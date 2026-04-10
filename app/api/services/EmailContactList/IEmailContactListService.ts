export interface ParsedContact {
  email: string
  name?: string
  customFields?: Record<string, string>
}

export interface IEmailContactListService {
  parseCsv(csvContent: string): ParsedContact[]
}
