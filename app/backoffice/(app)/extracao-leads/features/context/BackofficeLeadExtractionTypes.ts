import type { LeadExtractionFiltersForm, LeadExtractionResultItem } from "../services/IBackofficeLeadExtractionService"

export const EMPTY_FILTERS: LeadExtractionFiltersForm = {
  mainCnae: "",
  states: [],
  municipalityCode: "",
  statusIds: [],
  natureIds: [],
  sizeIds: [],
  simplesOptant: "",
  simeiOptant: "",
  foundedGte: "",
  foundedLte: "",
  hasPhone: false,
  hasEmail: false,
  removeContadores: true,
}

export interface BackofficeLeadExtractionContextValue {
  filters: LeadExtractionFiltersForm
  setFilters: React.Dispatch<React.SetStateAction<LeadExtractionFiltersForm>>
  results: LeadExtractionResultItem[]
  totalCount: number
  extractionId: string | null
  isSearching: boolean
  hasSearched: boolean
  handleSearch: () => Promise<void>
  clearFilters: () => void
}
