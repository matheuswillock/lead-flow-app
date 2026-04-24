import { Output } from '@/lib/output';
import { performanceService } from '@/app/api/services/Performance/PerformanceService';
import type { IPerformanceUseCase } from './IPerformanceUseCase';
import type { PerformanceSalesFilters } from '@/app/api/services/Performance/IPerformanceService';
import { addDaysInTz, endOfDayInTz, startOfDayInTz, DEFAULT_TZ } from '@/lib/dates';

export class PerformanceUseCase implements IPerformanceUseCase {
  static resolvePresetToDates(preset: string, tz: string = DEFAULT_TZ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = endOfDayInTz(now, tz);
    let startDate: Date;
    switch (preset) {
      case '1d':
        startDate = startOfDayInTz(addDaysInTz(now, -1, tz), tz);
        break;
      case '7d':
        startDate = startOfDayInTz(addDaysInTz(now, -7, tz), tz);
        break;
      case '15d':
        startDate = startOfDayInTz(addDaysInTz(now, -15, tz), tz);
        break;
      case '3m':
        startDate = startOfDayInTz(addDaysInTz(now, -90, tz), tz);
        break;
      case '1m':
      default:
        startDate = startOfDayInTz(addDaysInTz(now, -30, tz), tz);
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
