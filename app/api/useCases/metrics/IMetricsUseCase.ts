import type { Output } from "@/lib/output";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

export interface MetricsFilters {
  supabaseId: string;
  teamId: string;
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
}

/**
 * Interface for Metrics Use Cases
 * Defines the contract for all metrics-related business operations
 */
export interface IMetricsUseCase {
  getDashboardMetrics(filters: MetricsFilters, ctx: TeamContext): Promise<Output>;
  getDetailedStatusMetrics(supabaseId: string, teamId: string, ctx: TeamContext): Promise<Output>;
}
