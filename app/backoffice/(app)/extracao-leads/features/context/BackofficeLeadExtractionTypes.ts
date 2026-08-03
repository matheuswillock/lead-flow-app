import type { LeadExtractionFiltersForm, LeadExtractionResultItem } from "../services/IBackofficeLeadExtractionService"

export const EMPTY_FILTERS: LeadExtractionFiltersForm = {
  mainCnae: "",
  sideCnae: true,
  state: "",
  municipalityCode: "",
  statusId: "",
  natureId: "",
  sizeId: "",
  simplesOptant: "",
  simeiOptant: "",
  foundedGte: "",
  foundedLte: "",
  hasPhone: false,
  hasEmail: false,
}

export interface BackofficeLeadExtractionContextValue {
  filters: LeadExtractionFiltersForm
  setFilters: React.Dispatch<React.SetStateAction<LeadExtractionFiltersForm>>
  results: LeadExtractionResultItem[]
  totalCount: number
  extractionId: string | null
  isSearching: boolean
  hasSearched: boolean
  removeContadores: boolean
  setRemoveContadores: (v: boolean) => void
  handleSearch: () => Promise<void>
  clearFilters: () => void
}
