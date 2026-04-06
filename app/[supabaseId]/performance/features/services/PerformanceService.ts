import type { IPerformanceService } from './IPerformanceService';
import type { PerformanceData, PerformanceFiltersState } from '../context/PerformanceTypes';

const inFlightRequests = new Map<string, Promise<PerformanceData>>();

function buildRequestKey(supabaseId: string, teamId: string, filters: PerformanceFiltersState): string {
  return `${supabaseId}|${teamId}|${filters.preset}|${filters.startDate}|${filters.endDate}|${filters.sdrId}|${filters.closerId}|${filters.search}|${filters.page}|${filters.pageSize}`;
}

class PerformanceService implements IPerformanceService {
  async getSalesPerformance(
    supabaseId: string,
    teamId: string,
    filters: PerformanceFiltersState
  ): Promise<PerformanceData> {
    const key = buildRequestKey(supabaseId, teamId, filters);
    const inflight = inFlightRequests.get(key);
    if (inflight) return inflight;

    const params = new URLSearchParams();

    if (filters.startDate && filters.endDate) {
      params.set('startDate', filters.startDate);
      params.set('endDate', filters.endDate);
    } else {
      params.set('preset', filters.preset);
    }

    if (filters.sdrId) params.set('sdrId', filters.sdrId);
    if (filters.closerId) params.set('closerId', filters.closerId);
    if (filters.search) params.set('search', filters.search);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));

    const request = fetch(`/api/v1/performance/sales?${params.toString()}`, {
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!json.isValid) {
          throw new Error(json.errorMessages?.[0] ?? 'Erro ao buscar performance');
        }
        return json.result as PerformanceData;
      })
      .finally(() => {
        inFlightRequests.delete(key);
      });

    inFlightRequests.set(key, request);
    return request;
  }
}

export const performanceService = new PerformanceService();
