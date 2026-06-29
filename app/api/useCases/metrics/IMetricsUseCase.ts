import type { Output } from "@/lib/output";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

export interface MetricsFilters {
  supabaseId: string;
  teamId: string;
  teamIds?: string[];
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
  teamScope?: 'active' | 'all';
  masterId?: string;
}

/**
 * Interface for Metrics Use Cases
 * Defines the contract for all metrics-related business operations
 */
export interface IMetricsUseCase {
  getDashboardMetrics(filters: MetricsFilters, ctx: TeamContext): Promise<Output>;
  getDetailedStatusMetrics(supabaseId: string, teamId: string, teamIds: string[], ctx: TeamContext): Promise<Output>;
}
