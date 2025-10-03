import { DashboardMetricsData, DetailedMetricsData, MetricsFilters } from '../services/DashboardMetricsService';

export interface IDashboardState {
  // Dados principais
  metrics: DashboardMetricsData | null;
  detailedMetrics: DetailedMetricsData[] | null;
  
  // Estados de controle
  isLoading: boolean;
  error: string | null;
  
  // Filtros
  filters: MetricsFilters;
  
  // Período customizado
  customDateRange: {
    startDate: string;
    endDate: string;
  } | null;
}

export interface IDashboardActions {
  // Ações de dados
  fetchMetrics: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  
  // Ações de filtros
  updateFilters: (newFilters: Partial<MetricsFilters>) => void;
  setPeriod: (period: '7d' | '30d' | '3m' | '6m' | '1y') => void;
  setCustomDateRange: (startDate: string, endDate: string) => void;
  clearCustomDateRange: () => void;
  
  // Ações de controle
  clearError: () => void;
  resetFilters: () => void;
}

export interface IDashboardContext extends IDashboardState, IDashboardActions {}

export type DashboardContextType = IDashboardContext | undefined;