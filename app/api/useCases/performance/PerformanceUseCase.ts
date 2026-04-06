import { Output } from '@/lib/output';
import { performanceService } from '@/app/api/services/Performance/PerformanceService';
import type { IPerformanceUseCase } from './IPerformanceUseCase';
import type { PerformanceSalesFilters } from '@/app/api/services/Performance/IPerformanceService';

export class PerformanceUseCase implements IPerformanceUseCase {
  static resolvePresetToDates(preset: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();
    switch (preset) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '15d':
        startDate.setDate(endDate.getDate() - 15);
        break;
      case '3m':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1m':
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    return { startDate, endDate };
  }

  async getSalesPerformance(filters: PerformanceSalesFilters): Promise<Output> {
    try {
      const result = await performanceService.getSalesPerformance(filters);
      return new Output(true, ['Performance de vendas obtida com sucesso'], [], result);
    } catch (error) {
      console.error('[PerformanceUseCase] Erro ao buscar performance de vendas:', error);
      return new Output(false, [], ['Erro ao buscar performance de vendas'], null);
    }
  }
}

export const performanceUseCase = new PerformanceUseCase();
