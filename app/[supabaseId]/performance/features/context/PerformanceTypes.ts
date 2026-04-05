export type PerformancePreset = '1d' | '7d' | '15d' | '1m' | '3m';
export const DEFAULT_PRESET: PerformancePreset = '1m';

export interface PerformanceFiltersState {
  preset: PerformancePreset;
  startDate: string;
  endDate: string;
  sdrId: string;
  closerId: string;
  search: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_PERFORMANCE_FILTERS: PerformanceFiltersState = {
  preset: '1m',
  startDate: '',
  endDate: '',
  sdrId: '',
  closerId: '',
  search: '',
  page: 1,
  pageSize: 20,
};

export function isPerformanceFiltersChanged(filters: PerformanceFiltersState): boolean {
  return (
    filters.preset !== DEFAULT_PRESET ||
    !!filters.startDate ||
    !!filters.endDate ||
    !!filters.sdrId ||
    !!filters.closerId ||
    !!filters.search
  );
}

export interface PerformanceRankingEntry {
  profileId: string;
  name: string;
  count: number;
  totalSalesValue: number;
}

export interface PerformanceSaleRow {
  leadId: string;
  leadCode: string;
  leadName: string;
  saleDate: string | null;
  meetingHeald: string | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  contractDueDate: string | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
}

export interface PerformanceSummary {
  soldLeads: number;
  totalSalesValue: number;
}

export interface PerformancePagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface PerformanceData {
  summary: PerformanceSummary;
  sdrRanking: PerformanceRankingEntry[];
  closerRanking: PerformanceRankingEntry[];
  rows: PerformanceSaleRow[];
  pagination: PerformancePagination;
}
