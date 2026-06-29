import type { TeamContext } from '@/app/api/infra/data/repositories/metrics/IMetricsRepository';
import { DashboardFilters } from "./types/DashboardFilters";
import { DashboardMetrics } from "./types/DashboardMetrics";
import { DetailedStatusMetrics } from "./types/DetailedStatusMetrics";

export interface IDashboardInfosService {
  getDashboardMetrics(filters: DashboardFilters, ctx: TeamContext): Promise<DashboardMetrics>;
  getDetailedStatusMetrics(supabaseId: string, teamId: string, teamIds: string[] | undefined, ctx: TeamContext): Promise<DetailedStatusMetrics[]>;
}
