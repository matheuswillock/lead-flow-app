import { Output } from '@/lib/output';
import { performanceMeetingsHeldService } from '@/app/api/services/Performance/PerformanceMeetingsHeldService';
import type { PerformanceMeetingsHeldFilters } from '@/app/api/services/Performance/IPerformanceMeetingsHeldService';

export class PerformanceMeetingsHeldUseCase {
  async getMeetingsHeld(filters: PerformanceMeetingsHeldFilters): Promise<Output> {
    try {
      const result = await performanceMeetingsHeldService.getMeetingsHeld(filters);
      return new Output(true, ['Reuniões realizadas obtidas com sucesso'], [], result);
    } catch (error) {
      console.error('[PerformanceMeetingsHeldUseCase] Erro ao buscar reuniões realizadas:', error);
      return new Output(false, [], ['Erro ao buscar reuniões realizadas'], null);
    }
  }
}

export const performanceMeetingsHeldUseCase = new PerformanceMeetingsHeldUseCase();
