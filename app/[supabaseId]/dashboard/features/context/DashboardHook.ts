"use client";

import { useEffect } from "react";
import { useDashboardContext } from "./DashboardContext";
import { DashboardFilters, TimePeriod } from "../types";

/**
 * Hook personalizado para gerenciar o estado do Dashboard
 * Seguindo padrão do board com funcionalidades específicas
 */
export function useDashboard(supabaseId: string | null) {
  const {
    state,
    loadMetrics,
    setPeriod,
    refreshData,
    clearError,
  } = useDashboardContext();

  // Carrega dados automaticamente quando supabaseId está disponível
  useEffect(() => {
    if (supabaseId) {
      loadMetrics(supabaseId, { period: state.selectedPeriod });
    }
  }, [supabaseId, loadMetrics, state.selectedPeriod]);

  // Função para alterar período e recarregar dados
  const changePeriod = (period: TimePeriod) => {
    setPeriod(period);
    if (supabaseId) {
      loadMetrics(supabaseId, { period });
    }
  };

  // Função para aplicar filtros
  const applyFilters = (filters: DashboardFilters) => {
    if (supabaseId) {
      loadMetrics(supabaseId, filters);
    }
  };

  // Função para forçar atualização
  const forceRefresh = () => {
    if (supabaseId) {
      refreshData(supabaseId);
    }
  };

  return {
    // Estado
    metrics: state.metrics,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    selectedPeriod: state.selectedPeriod,
    
    // Ações
    changePeriod,
    applyFilters,
    refresh: forceRefresh,
    clearError,
    
    // Dados computados
    hasData: !!state.metrics,
    isEmpty: !state.isLoading && !state.metrics,
    hasError: !!state.error,
  };
}