import type { Output } from "@/lib/output";

export interface MetricsFilters {
  managerId: string;
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
}

/**
 * Interface for Metrics Use Cases
 * Defines the contract for all metrics-related business operations
 */
export interface IMetricsUseCase {
  getDashboardMetrics(filters: MetricsFilters): Promise<Output>;
  getDetailedStatusMetrics(managerId: string): Promise<Output>;
}