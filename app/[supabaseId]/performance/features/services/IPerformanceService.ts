import type { PerformanceData, PerformanceFiltersState } from '../context/PerformanceTypes';

export interface IPerformanceService {
  getSalesPerformance(
    supabaseId: string,
    teamId: string,
    filters: PerformanceFiltersState
  ): Promise<PerformanceData>;
}
