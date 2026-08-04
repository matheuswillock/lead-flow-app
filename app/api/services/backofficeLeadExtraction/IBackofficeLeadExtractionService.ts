import type { LeadExtractionFilters, LeadExtractionResultData } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/IBackofficeLeadExtractionRepository"

export interface LeadExtractionSearchOutput {
  items: LeadExtractionResultData[]
  totalCount: number
}

export interface IBackofficeLeadExtractionService {
  search(filters: LeadExtractionFilters, limit?: number): Promise<LeadExtractionSearchOutput>
}
