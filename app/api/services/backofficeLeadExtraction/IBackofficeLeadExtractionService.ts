import type { LeadExtractionFilters, LeadExtractionResultData } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/IBackofficeLeadExtractionRepository"

export interface LeadExtractionSearchOutput {
  items: LeadExtractionResultData[]
  totalCount: number
}

export interface PersonSearchFilters {
  names?: string[]
  types?: ("NATURAL" | "LEGAL" | "FOREIGN" | "UNKNOWN")[]
  ageRanges?: string[]
}

export type PersonAgeRange = "0-12" | "13-20" | "21-30" | "31-40" | "41-50" | "51-60" | "61-70" | "71-80" | "81+"

export interface PersonMembershipItem {
  since: string
  company: { id: number; name: string }
  role: { id: number; text: string }
}

export interface PersonSearchResultItem {
  id: string
  type: string
  name: string
  taxId?: string
  age?: string
  membership: PersonMembershipItem[]
}

export interface PersonSearchOutput {
  items: PersonSearchResultItem[]
  totalCount: number
}

export interface IBackofficeLeadExtractionService {
  search(filters: LeadExtractionFilters, limit?: number): Promise<LeadExtractionSearchOutput>
  searchPersons(filters: PersonSearchFilters, limit?: number): Promise<PersonSearchOutput>
}
