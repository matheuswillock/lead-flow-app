'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DashboardContextType, IDashboardContext } from './DashboardTypes';
import { useDashboardHook } from './DashboardHook';
import { IDashboardMetricsService, MetricsFilters } from '../services/IDashboardMetricsService';
import { dashboardMetricsService } from '../services/DashboardMetricsService';

interface IDashboardProviderProps {
  children: ReactNode;
  dashboardService?: IDashboardMetricsService;
  initialFilters?: MetricsFilters;
}

// Contexto
export const DashboardContext = createContext<DashboardContextType>(undefined);

// Provider
export const DashboardProvider: React.FC<IDashboardProviderProps> = ({
  children,
  dashboardService = dashboardMetricsService,
  initialFilters = { period: '30d' }
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  // Hook com toda a lógica
  const dashboardState = useDashboardHook({
    supabaseId,
    dashboardService,
    initialFilters
  });

  // Buscar métricas quando o componente montar ou filtros mudarem
  useEffect(() => {
    if (supabaseId) {
      dashboardState.fetchMetrics();
    }
  }, [supabaseId, dashboardState.fetchMetrics, dashboardState.filters, dashboardState.customDateRange]);

  return (
    <DashboardContext.Provider value={dashboardState}>
      {children}
    </DashboardContext.Provider>
  );
};

// Hook para usar o contexto
export const useDashboardContext = (): IDashboardContext => {
  const context = useContext(DashboardContext);
  
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  
  return context;
};