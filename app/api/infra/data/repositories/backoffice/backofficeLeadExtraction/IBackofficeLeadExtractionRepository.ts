import type { BackofficeLeadExtractionStatus } from "@prisma/client"

export interface LeadExtractionFilters {
  mainCnae?: string
  sideCnae?: string
  state?: string
  municipalityCode?: number
  statusId?: string
  natureId?: string
  sizeId?: string
  simplesOptant?: boolean
  simeiOptant?: boolean
  foundedGte?: string
  foundedLte?: string
  hasPhone?: boolean
  hasEmail?: boolean
}

export interface LeadExtractionResultData {
  taxId: string
  name: string
  tradeName?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  cnae?: string | null
  cnaeName?: string | null
  type?: string | null
  raw?: object | null
}

export interface ExtractionListItem {
  id: string
  profileId: string
  filters: unknown
  totalCount: number
  status: BackofficeLeadExtractionStatus
  createdAt: Date
  updatedAt: Date
}

export interface ExtractionWithResults extends ExtractionListItem {
  results: Array<LeadExtractionResultData & { id: string; createdAt: Date }>
}

export interface IBackofficeLeadExtractionRepository {
  create(profileId: string, filters: LeadExtractionFilters): Promise<ExtractionListItem>
  updateStatus(id: string, status: BackofficeLeadExtractionStatus, totalCount?: number): Promise<void>
  saveResults(extractionId: string, results: LeadExtractionResultData[]): Promise<void>
  findById(id: string): Promise<ExtractionListItem | null>
  findWithResults(id: string, page: number, pageSize: number): Promise<ExtractionWithResults | null>
  listByProfile(profileId: string, page: number, pageSize: number): Promise<{ items: ExtractionListItem[]; total: number }>
}
