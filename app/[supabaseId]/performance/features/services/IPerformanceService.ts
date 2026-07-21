import type { PerformanceData, PerformanceFiltersState, PerformanceTeamScope } from '../context/PerformanceTypes';
import type { PerformanceExportFormat, PerformanceExportSectionFlags } from '@/lib/performance/exportPerformanceFiles';

export interface SendPerformanceExportEmailInput {
  format: PerformanceExportFormat;
  preset?: "1d" | "7d" | "15d" | "1m" | "3m";
  startDate?: string;
  endDate?: string;
  sdrId?: string;
  closerId?: string;
  search?: string;
  sections: PerformanceExportSectionFlags;
}

export interface IPerformanceService {
  getSalesPerformance(
    supabaseId: string,
    teamId: string,
    filters: PerformanceFiltersState,
    teamScope?: PerformanceTeamScope
  ): Promise<PerformanceData>;

  sendPerformanceExportEmail(
    supabaseId: string,
    teamId: string,
    input: SendPerformanceExportEmailInput
  ): Promise<void>;
}
