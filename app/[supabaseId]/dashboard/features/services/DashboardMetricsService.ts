import { 
  IDashboardMetricsService, 
  DashboardMetricsData, 
  DetailedMetricsData, 
  MetricsFilters 
} from "./IDashboardMetricsService";

// Re-exportar os tipos para facilitar importação
export type { DashboardMetricsData, DetailedMetricsData, MetricsFilters };

// Configuração de cache
const CACHE_KEY_PREFIX = 'dashboard_metrics';
const DETAILED_CACHE_KEY_PREFIX = `${CACHE_KEY_PREFIX}_detailed`;
const CACHE_VERSION = '7';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos em milissegundos
const metricsInFlightByCacheKey = new Map<string, Promise<DashboardMetricsData>>();
const detailedInFlightByCacheKey = new Map<string, Promise<DetailedMetricsData[]>>();

interface CachedData<T> {
  data: T;
  timestamp: number;
  filters?: MetricsFilters;
  version: string;
}

export class DashboardMetricsService implements IDashboardMetricsService {
  
  /**
   * Gera chave única para cache baseada nos parâmetros
   */
  private getCacheKey(supabaseId: string, teamId: string, filters?: MetricsFilters): string {
    const filterKey = filters 
      ? `_${filters.period || 'default'}_${filters.startDate || ''}_${filters.endDate || ''}`
      : '_default';
    return `${CACHE_KEY_PREFIX}_${supabaseId}_${teamId}${filterKey}`;
  }

  /**
   * Gera chave única para cache de métricas detalhadas por time
   */
  private getDetailedCacheKey(supabaseId: string, teamId: string): string {
    return `${DETAILED_CACHE_KEY_PREFIX}_${supabaseId}_${teamId}`;
  }

  /**
   * Busca dados do cache
   */
  private getFromCache<T>(cacheKey: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const cachedParsed = JSON.parse(cached) as CachedData<T>;
      if (!cachedParsed.version || cachedParsed.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      const { data, timestamp } = cachedParsed;
      const now = Date.now();

      // Verificar se o cache ainda é válido (15 minutos)
      if (now - timestamp > CACHE_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data;

    } catch (error) {
      console.error('Erro ao ler cache:', error);
      return null;
    }
  }

  /**
   * Salva dados no cache
   */
  private saveToCache<T>(cacheKey: string, data: T, filters?: MetricsFilters): void {
    if (typeof window === 'undefined') return;

    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        filters,
        version: CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cachedData));

    } catch (error) {
      console.error('Erro ao salvar cache:', error);
      // Se localStorage estiver cheio, limpar caches antigos
      this.clearExpiredCaches();
    }
  }

  /**
   * Limpa todos os caches expirados
   */
  private clearExpiredCaches(): void {
    if (typeof window === 'undefined') return;

    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      // Iterar sobre todas as chaves do localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CACHE_KEY_PREFIX)) continue;

        try {
          const cached = localStorage.getItem(key);
          if (!cached) continue;

          const { timestamp } = JSON.parse(cached);
          
          if (now - timestamp > CACHE_TTL) {
            keysToRemove.push(key);
          }
        } catch (_error) {
          keysToRemove.push(key); // Remover cache corrompido
        }
      }

      // Remover caches expirados
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

    } catch (error) {
      console.error('Erro ao limpar caches expirados:', error);
    }
  }

  /**
   * Limpa cache específico
   */
  public clearCache(supabaseId: string, teamId: string, filters?: MetricsFilters): void {
    if (typeof window === 'undefined') return;
    const cacheKey = this.getCacheKey(supabaseId, teamId, filters);
    localStorage.removeItem(cacheKey);
    metricsInFlightByCacheKey.delete(cacheKey);
  }

  /**
   * Limpa cache de métricas detalhadas de um time
   */
  public clearDetailedCache(supabaseId: string, teamId: string): void {
    if (typeof window === 'undefined') return;
    const cacheKey = this.getDetailedCacheKey(supabaseId, teamId);
    localStorage.removeItem(cacheKey);
    detailedInFlightByCacheKey.delete(cacheKey);
  }

  /**
   * Limpa todos os caches do dashboard
   */
  public clearAllCache(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      metricsInFlightByCacheKey.clear();
      detailedInFlightByCacheKey.clear();

    } catch (error) {
      console.error('Erro ao limpar todos os caches:', error);
    }
  }

  /**
   * Busca métricas gerais do dashboard (com cache)
   */
  async getMetrics(supabaseId: string, teamId: string, filters?: MetricsFilters): Promise<DashboardMetricsData> {
    try {
      // Tentar buscar do cache
      const cacheKey = this.getCacheKey(supabaseId, teamId, filters);
      const cachedData = this.getFromCache<DashboardMetricsData>(cacheKey);

      if (cachedData) {
        return cachedData;
      }

      const existingRequest = metricsInFlightByCacheKey.get(cacheKey);
      if (existingRequest) {
        return await existingRequest;
      }

      const requestPromise = (async (): Promise<DashboardMetricsData> => {
        // Construir query params
        const params = new URLSearchParams();

        if (filters?.period) {
          params.append('period', filters.period);
        }

        if (filters?.startDate) {
          params.append('startDate', filters.startDate);
        }

        if (filters?.endDate) {
          params.append('endDate', filters.endDate);
        }

        // Fazer requisição para a API
        const response = await fetch(`/api/v1/dashboard/metrics?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-supabase-user-id': supabaseId,
            'x-team-id': teamId,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.isValid) {
          throw new Error(data.errorMessages?.join(', ') || 'Erro desconhecido');
        }

        // Salvar no cache
        this.saveToCache(cacheKey, data.result, filters);

        return data.result;
      })();

      metricsInFlightByCacheKey.set(
        cacheKey,
        requestPromise.finally(() => {
          metricsInFlightByCacheKey.delete(cacheKey);
        })
      );

      return await requestPromise;
    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Erro interno ao buscar métricas'
      );
    }
  }

  /**
   * Busca métricas detalhadas por status
   */
  async getDetailedMetrics(supabaseId: string, teamId: string): Promise<DetailedMetricsData[]> {
    try {
      const cacheKey = this.getDetailedCacheKey(supabaseId, teamId);
      const cachedData = this.getFromCache<DetailedMetricsData[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const existingRequest = detailedInFlightByCacheKey.get(cacheKey);
      if (existingRequest) {
        return await existingRequest;
      }

      const requestPromise = (async (): Promise<DetailedMetricsData[]> => {
        // Fazer requisição para a API usando URL relativa
        const response = await fetch(`/api/v1/dashboard/metrics/detailed/${supabaseId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-supabase-user-id': supabaseId,
            'x-team-id': teamId,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.isValid) {
          throw new Error(data.errorMessages?.join(', ') || 'Erro desconhecido');
        }

        this.saveToCache(cacheKey, data.result);
        return data.result;
      })();

      detailedInFlightByCacheKey.set(
        cacheKey,
        requestPromise.finally(() => {
          detailedInFlightByCacheKey.delete(cacheKey);
        })
      );

      return await requestPromise;

    } catch (error) {
      console.error('Erro ao buscar métricas detalhadas:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Erro interno ao buscar métricas detalhadas'
      );
    }
  }
}

// Instância única para uso em toda aplicação (Singleton)
export const dashboardMetricsService = new DashboardMetricsService();
