export interface PerformanceSalesFilters {
  teamId: string;
  profileId: string;
  isManager: boolean;
  isCloser: boolean;
  startDate: Date;
  endDate: Date;
  sdrId?: string;
  closerId?: string;
  search?: string;
  page: number;
  pageSize: number;
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
  saleDate: Date | null;
  meetingHeald: string | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  contractDueDate: Date | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
}

export interface SparklineDataPoint {
  value: number;
}

export interface PerformanceKpis {
  closedSales: number;
  closedSalesSparkline: SparklineDataPoint[];
  meetingsHeld: number;
  meetingsHeldSparkline: SparklineDataPoint[];
  scheduledLeads: number;
  scheduledLeadsSparkline: SparklineDataPoint[];
  noShowRate: number;
  noShowCount: number;
  noShowRateSparkline: SparklineDataPoint[];
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
}

export interface PerformanceSalesResult {
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
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface IPerformanceService {
  getSalesPerformance(filters: PerformanceSalesFilters): Promise<PerformanceSalesResult>;
}
