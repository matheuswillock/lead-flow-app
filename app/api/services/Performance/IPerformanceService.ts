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

export interface PerformanceSalesResult {
  summary: {
    soldLeads: number;
    totalSalesValue: number;
  };
  sdrRanking: PerformanceRankingEntry[];
  closerRanking: PerformanceRankingEntry[];
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
