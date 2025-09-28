'use client'

import { useState, useEffect } from 'react';
import { 
  dashboardMetricsService, 
  DashboardMetricsData, 
  DetailedMetricsData, 
  MetricsFilters 
} from '../services/DashboardMetricsService';

interface UseDashboardMetricsReturn {
  metrics: DashboardMetricsData | null;
  detailedMetrics: DetailedMetricsData[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateFilters: (filters: MetricsFilters) => void;
}

/**
 * Hook personalizado para gerenciar métricas do dashboard
 */
export function useDashboardMetrics(supabaseId: string, initialFilters?: MetricsFilters): UseDashboardMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(null);
  const [detailedMetrics, setDetailedMetrics] = useState<DetailedMetricsData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MetricsFilters>(initialFilters || { period: '30d' });

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, detailedData] = await Promise.all([
        dashboardMetricsService.getMetrics(supabaseId, filters),
        dashboardMetricsService.getDetailedMetrics(supabaseId),
      ]);

      setMetrics(metricsData);
      setDetailedMetrics(detailedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro no hook useDashboardMetrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters: MetricsFilters) => {
    setFilters((prev: MetricsFilters) => ({ ...prev, ...newFilters }));
  };

  // Buscar métricas quando supabaseId ou filtros mudarem
  useEffect(() => {
    if (supabaseId) {
      fetchMetrics();
    }
  }, [supabaseId, filters]);

  return {
    metrics,
    detailedMetrics,
    loading,
    error,
    refetch: fetchMetrics,
    updateFilters,
  };
}

/**
 * Hook mais simples para buscar apenas métricas gerais
 */
export function useDashboardMetricsSimple(supabaseId: string, period: '7d' | '30d' | '3m' | '6m' | '1y' = '30d') {
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await dashboardMetricsService.getMetrics(supabaseId, { period });
        setMetrics(data);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (supabaseId) {
      fetchMetrics();
    }
  }, [supabaseId, period]);

  return { metrics, loading, error };
}