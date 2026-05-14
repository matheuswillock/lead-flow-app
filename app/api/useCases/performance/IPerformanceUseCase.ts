import { Output } from '@/lib/output';
import type { PerformanceSalesFilters } from '@/app/api/services/Performance/IPerformanceService';
import type {
  PerformanceExportFormat,
  PerformanceExportSectionFlags,
} from '@/lib/performance/exportPerformanceFiles';

export interface SendPerformanceExportEmailInput {
  requesterEmail: string;
  requesterName: string;
  format: PerformanceExportFormat;
  sections: PerformanceExportSectionFlags;
  presetLabel: string;
  filters: PerformanceSalesFilters;
}

export interface IPerformanceUseCase {
  getSalesPerformance(filters: PerformanceSalesFilters): Promise<Output>;
  sendSalesPerformanceExportEmail(input: SendPerformanceExportEmailInput): Promise<Output>;
}
