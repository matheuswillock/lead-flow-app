import {
  BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT,
} from "@/lib/backoffice/lead-extraction-constants"
import type {
  CnaeOption,
  LeadExtractionFiltersForm,
  LeadExtractionResultItem,
  SocioFiltersForm,
  SocioResultItem,
} from "../services/IBackofficeLeadExtractionService"

export const EMPTY_FILTERS: LeadExtractionFiltersForm = {
  mainCnae: "",
  states: [],
  municipalityCodes: [],
  natureIds: [],
  sizeIds: [],
  simplesOptant: "",
  simeiOptant: "",
  foundedGte: "",
  foundedLte: "",
  hasPhone: false,
  hasEmail: false,
  removeContadores: true,
  limit: BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT,
}

export const EMPTY_SOCIO_FILTERS: SocioFiltersForm = {
  names: "",
  types: [],
  ageRanges: [],
}

export interface BackofficeLeadExtractionContextValue {
  // tab
  activeTab: "empresas" | "socios"
  setActiveTab: React.Dispatch<React.SetStateAction<"empresas" | "socios">>
  // empresas
  filters: LeadExtractionFiltersForm
  setFilters: React.Dispatch<React.SetStateAction<LeadExtractionFiltersForm>>
  results: LeadExtractionResultItem[]
  totalCount: number
  extractionId: string | null
  isSearching: boolean
  hasSearched: boolean
  handleSearch: () => Promise<void>
  clearFilters: () => void
  searchCnaes: (q?: string) => Promise<CnaeOption[]>
  // socios
  socioFilters: SocioFiltersForm
  setSocioFilters: React.Dispatch<React.SetStateAction<SocioFiltersForm>>
  socioResults: SocioResultItem[]
  socioTotalCount: number
  isSocioSearching: boolean
  hasSearchedSocios: boolean
  handleSocioSearch: () => Promise<void>
  clearSocioFilters: () => void
}
