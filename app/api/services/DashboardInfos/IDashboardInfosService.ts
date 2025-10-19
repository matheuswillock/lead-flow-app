import { DashboardFilters } from "./types/DashboardFilters";
import { DashboardMetrics } from "./types/DashboardMetrics";
import { DetailedStatusMetrics } from "./types/DetailedStatusMetrics";

export interface IDashboardInfosService {
  getDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetrics>;
  getDetailedStatusMetrics(supabaseId: string): Promise<DetailedStatusMetrics[]>;
}