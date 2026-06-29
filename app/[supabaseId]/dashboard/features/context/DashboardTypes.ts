import { DashboardMetricsData, DetailedMetricsData, MetricsFilters, DashboardTeamScope } from '../services/DashboardMetricsService';

export type { DashboardTeamScope };

export interface IDashboardState {
  // Dados principais
  metrics: DashboardMetricsData | null;
  detailedMetrics: DetailedMetricsData[] | null;
  
  // Estados de controle
  isLoading: boolean;
  error: string | null;
  
  // Filtros
  filters: MetricsFilters;
  teamScope: DashboardTeamScope;
  canUseAllTeamsScope: boolean;
  
  // Período customizado
  customDateRange: {
    startDate: string;
    endDate: string;
  } | null;
  
  // Controle de privacidade
  isBlurred: boolean;
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
  setTeamScope: (scope: DashboardTeamScope) => void;
  
  // Ações de controle
  clearError: () => void;
  resetFilters: () => void;
  
  // Ação de privacidade
  toggleBlur: () => void;
}

export interface IDashboardContext extends IDashboardState, IDashboardActions {}

export type DashboardContextType = IDashboardContext | undefined;
