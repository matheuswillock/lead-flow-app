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
  sideCnae: boolean
  state: string
  municipalityCode: string
  statusId: string
  natureId: string
  sizeId: string
  simplesOptant: string
  simeiOptant: string
  foundedGte: string
  foundedLte: string
  hasPhone: boolean
  hasEmail: boolean
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

export interface IBackofficeLeadExtractionFrontendService {
  search(filters: LeadExtractionFiltersForm): Promise<LeadExtractionSearchResult>
}
