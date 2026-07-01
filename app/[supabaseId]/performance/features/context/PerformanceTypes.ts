export type PerformancePreset = '1d' | '7d' | '15d' | '1m' | '3m';
export const DEFAULT_PRESET: PerformancePreset = '7d';
export type PerformanceTeamScope = 'active' | 'all';

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
  preset: '7d',
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
  meetingsHeld: number;
  noShowCount: number;
  attendanceRate: number;
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

export interface SparklineDataPoint {
  value: number;
}

export type PerformanceActivityKind =
  | 'sale'
  | 'meeting_held'
  | 'proposal_sent'
  | 'no_show'
  | 'scheduled'
  | 'new_lead';

export interface PerformanceRecentActivity {
  kind: PerformanceActivityKind;
  text: string;
  leadCode: string;
  leadName: string;
  createdAt: string;
}

export interface PerformanceKpis {
  closedSales: number;
  closedSalesSparkline: SparklineDataPoint[];
  closedSalesDelta: number;
  meetingsHeld: number;
  meetingsHeldSparkline: SparklineDataPoint[];
  meetingsHeldDelta: number;
  scheduledLeads: number;
  scheduledLeadsSparkline: SparklineDataPoint[];
  scheduledLeadsDelta: number;
  noShowRate: number;
  noShowCount: number;
  noShowRateSparkline: SparklineDataPoint[];
  noShowRateDelta: number;
}

export interface PerformanceHighlight {
  profileId: string;
  name: string;
  roleLabel: 'Closer' | 'SDR';
  value: number;
  suffix: 'vendas' | 'agend.';
  attendanceRate: number;
  totalSalesValue: number;
}

export interface PerformanceDrilldownEntry {
  profileId: string;
  name: string;
  roleLabel: 'Closer' | 'SDR';
  email: string;
  salesCount: number;
  scheduledLeads: number;
  meetingsHeld: number;
  noShowCount: number;
  noShowRate: number;
  attendanceRate: number;
  totalSalesValue: number;
  recentActivities: PerformanceRecentActivity[];
}

export interface PerformancePagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export type PerformanceViewMode = 'team' | 'self';

export interface PerformanceData {
  viewMode: PerformanceViewMode;
  kpis: PerformanceKpis;
  highlights: {
    topCloser: PerformanceHighlight | null;
    topSdr: PerformanceHighlight | null;
  };
  rankings: {
    sdr: PerformanceRankingEntry[];
    closer: PerformanceRankingEntry[];
  };
  drilldown: PerformanceDrilldownEntry[];
  rows: PerformanceSaleRow[];
  pagination: PerformancePagination;
}
