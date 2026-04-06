import { Output } from '@/lib/output';
import type { PerformanceSalesFilters } from '@/app/api/services/Performance/IPerformanceService';

export interface IPerformanceUseCase {
  getSalesPerformance(filters: PerformanceSalesFilters): Promise<Output>;
}
