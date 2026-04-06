export type PortfolioStatusFilter = 'all' | 'active' | 'pending' | 'canceled';
export type PortfolioStatusValue = 'active' | 'pending' | 'canceled';

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatusValue, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  canceled: 'Cancelado',
};

export interface CarteiraFiltersState {
  search: string;
  portfolioStatus: PortfolioStatusFilter;
  sdrId: string;
  closerId: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_CARTEIRA_FILTERS: CarteiraFiltersState = {
  search: '',
  portfolioStatus: 'all',
  sdrId: '',
  closerId: '',
  page: 1,
  pageSize: 20,
};

export function isCarteiraFiltersChanged(filters: CarteiraFiltersState): boolean {
  return (
    !!filters.search ||
    filters.portfolioStatus !== 'all' ||
    !!filters.sdrId ||
    !!filters.closerId
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
  pagination: CarteiraPagination;
}

export interface UpdateCarteiraData {
  portfolioStatus?: PortfolioStatusValue;
  note?: string | null;
  lastContactAt?: string | null;
}
