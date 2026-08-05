export type BackofficeCompanyType =
  | "MEI"
  | "ME"
  | "EPP"
  | "EI"
  | "EIRELI"
  | "SLU"
  | "LTDA"
  | "SA"
  | "SS"
  | "OUTROS"

export interface LeadExtractionFiltersForm {
  mainCnae: string
  states: string[]
  municipalityCode: string
  statusIds: string[]
  natureIds: string[]
  sizeIds: string[]
  simplesOptant: string
  simeiOptant: string
  foundedGte: string
  foundedLte: string
  hasPhone: boolean
  hasEmail: boolean
  removeContadores: boolean
}

export interface LeadExtractionResultItem {
  taxId: string
  name: string
  tradeName: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  cnae: string | null
  cnaeName: string | null
  type: BackofficeCompanyType | null
}

export interface LeadExtractionSearchResult {
  extractionId: string
  totalCount: number
  items: LeadExtractionResultItem[]
}

export interface CnaeOption {
  code: string
  name: string
}

export interface SocioFiltersForm {
  names: string
  types: string[]
  ageRanges: string[]
}

export interface SocioMembership {
  since: string
  company: { id: number; name: string }
  role: { id: number; text: string }
}

export interface SocioResultItem {
  id: string
  type: string
  name: string
  taxId?: string
  age?: string
  membership: SocioMembership[]
}

export interface SocioSearchResult {
  items: SocioResultItem[]
  totalCount: number
}

export interface IBackofficeLeadExtractionFrontendService {
  search(filters: LeadExtractionFiltersForm): Promise<LeadExtractionSearchResult>
  searchCnaes(q?: string): Promise<CnaeOption[]>
  searchSocios(filters: SocioFiltersForm): Promise<SocioSearchResult>
}
