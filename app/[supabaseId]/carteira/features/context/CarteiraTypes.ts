export type PortfolioStatusValue = 'active' | 'pending' | 'canceled';

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatusValue, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  canceled: 'Cancelado',
};

export interface CarteiraFiltersState {
  search: string;
  portfolioStatuses: string[];
  sdrIds: string[];
  closerIds: string[];
  operadora: string;
  contractDateStart: string;
  contractDateEnd: string;
  dueDateStart: string;
  dueDateEnd: string;
  documentSearch: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_CARTEIRA_FILTERS: CarteiraFiltersState = {
  search: '',
  portfolioStatuses: [],
  sdrIds: [],
  closerIds: [],
  operadora: '',
  contractDateStart: '',
  contractDateEnd: '',
  dueDateStart: '',
  dueDateEnd: '',
  documentSearch: '',
  page: 1,
  pageSize: 20,
};

export function isCarteiraFiltersChanged(filters: CarteiraFiltersState): boolean {
  return (
    !!filters.search ||
    filters.portfolioStatuses.length > 0 ||
    filters.sdrIds.length > 0 ||
    filters.closerIds.length > 0 ||
    !!filters.operadora ||
    !!filters.contractDateStart ||
    !!filters.contractDateEnd ||
    !!filters.dueDateStart ||
    !!filters.dueDateEnd ||
    !!filters.documentSearch
  );
}

export interface CarteiraRow {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  portfolioStatus: PortfolioStatusValue;
  note: string | null;
  lastContactAt: string | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  operadora: string | null;
  contractStartDate: string | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
  contractDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarteiraPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface CarteiraData {
  rows: CarteiraRow[];
  availableOperadoras: string[];
  pagination: CarteiraPagination;
}

export interface UpdateCarteiraData {
  portfolioStatus?: PortfolioStatusValue;
  note?: string | null;
  lastContactAt?: string | null;
}

export interface UpdateCarteiraDetailPayload {
  operadora?: string | null;
  productName?: string | null;
  amount?: number;
  startDateAt?: string;
  finalizedDateAt?: string;
  contractDueDate?: string | null;
  soldPlan?: string | null;
  notes?: string | null;
  holder?: {
    name: string;
    birthDate: string;
    document: string;
    cnpj?: string | null;
  } | null;
  dependents?: Array<{
    id?: string;
    name: string;
    birthDate: string;
    parentesco: string;
    document?: string | null;
  }>;
}

export interface CarteiraDetailAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploaderName: string | null;
}

export interface CarteiraDetailContract {
  operadora: string | null;
  productName: string | null;
  amount: number;
  startDateAt: string;
  finalizedDateAt: string;
  contractFileUrl: string | null;
  notes: string | null;
  closerName: string | null;
}

export interface CarteiraDetailHolder {
  name: string;
  birthDate: string;
  document: string;
  cnpj: string | null;
}

export interface CarteiraDetailDependent {
  id: string;
  name: string;
  birthDate: string;
  parentesco: string;
  document: string | null;
}

export interface CarteiraDetailData {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  saleValue: number;
  portfolioStatus: PortfolioStatusValue;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  contractDueDate: string | null;
  contract: CarteiraDetailContract | null;
  holder: CarteiraDetailHolder | null;
  dependents: CarteiraDetailDependent[];
  attachments: CarteiraDetailAttachment[];
}
