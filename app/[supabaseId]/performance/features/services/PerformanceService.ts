import type { IPerformanceService, SendPerformanceExportEmailInput } from './IPerformanceService';
import type { PerformanceData, PerformanceFiltersState } from '../context/PerformanceTypes';

const CACHE_VERSION = 2;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface CachedEntry {
  data: PerformanceData;
  timestamp: number;
  version: number;
}

const inFlightRequests = new Map<string, Promise<PerformanceData>>();

function buildCacheKey(supabaseId: string, teamId: string, filters: PerformanceFiltersState): string {
  return `performance_v${CACHE_VERSION}_${supabaseId}_${teamId}_${filters.preset}_${filters.startDate}_${filters.endDate}_${filters.sdrId}_${filters.closerId}_${filters.search}_${filters.page}_${filters.pageSize}`;
}

function readCache(key: string): PerformanceData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    if (entry.version !== CACHE_VERSION) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: PerformanceData): void {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now(), version: CACHE_VERSION };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

class PerformanceService implements IPerformanceService {
  async getSalesPerformance(
    supabaseId: string,
    teamId: string,
    filters: PerformanceFiltersState
  ): Promise<PerformanceData> {
    const key = buildCacheKey(supabaseId, teamId, filters);

    const cached = readCache(key);
    if (cached) return cached;

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
        const data = json.result as PerformanceData;
        writeCache(key, data);
        return data;
      })
      .finally(() => {
        inFlightRequests.delete(key);
      });

    inFlightRequests.set(key, request);
    return request;
  }

  clearCache(supabaseId: string, teamId: string, filters: PerformanceFiltersState): void {
    const key = buildCacheKey(supabaseId, teamId, filters);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  async sendPerformanceExportEmail(
    supabaseId: string,
    teamId: string,
    input: SendPerformanceExportEmailInput
  ): Promise<void> {
    const res = await fetch('/api/v1/performance/sales/export/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok || !json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? 'Erro ao enviar exportação por e-mail');
    }
  }
}

export const performanceService = new PerformanceService();
