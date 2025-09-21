"use client";

import React, { createContext, useContext, useReducer, useCallback } from "react";
import { DashboardState, DashboardMetrics, DashboardFilters, TimePeriod } from "../types";
import { DashboardService } from "../services/DashboardService";

// Estado inicial
const initialState: DashboardState = {
  metrics: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  selectedPeriod: "30d",
};

// Actions
type DashboardAction =
  | { type: "LOADING_START" }
  | { type: "LOADING_SUCCESS"; payload: DashboardMetrics }
  | { type: "LOADING_ERROR"; payload: string }
  | { type: "SET_PERIOD"; payload: TimePeriod }
  | { type: "CLEAR_ERROR" }
  | { type: "REFRESH_DATA" };

// Reducer
function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "LOADING_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case "LOADING_SUCCESS":
      return {
        ...state,
        isLoading: false,
        metrics: action.payload,
        error: null,
        lastUpdated: new Date(),
      };
    case "LOADING_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        metrics: null,
      };
    case "SET_PERIOD":
      return {
        ...state,
        selectedPeriod: action.payload,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    case "REFRESH_DATA":
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    default:
      return state;
  }
}

// Context
interface DashboardContextValue {
  state: DashboardState;
  loadMetrics: (supabaseId: string, filters?: DashboardFilters) => Promise<void>;
  setPeriod: (period: TimePeriod) => void;
  refreshData: (supabaseId: string) => Promise<void>;
  clearError: () => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

// Provider
interface DashboardProviderProps {
  children: React.ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const dashboardService = new DashboardService();

  const loadMetrics = useCallback(async (supabaseId: string, filters?: DashboardFilters) => {
    dispatch({ type: "LOADING_START" });
    
    try {
      const result = await dashboardService.getDashboardMetrics(supabaseId, filters);
      
      if (result.isValid && result.result) {
        dispatch({ type: "LOADING_SUCCESS", payload: result.result });
      } else {
        const errorMessage = result.errorMessages?.join(", ") || "Erro ao carregar métricas";
        dispatch({ type: "LOADING_ERROR", payload: errorMessage });
      }
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
      dispatch({ type: "LOADING_ERROR", payload: "Erro inesperado ao carregar dados" });
    }
  }, [dashboardService]);

  const setPeriod = useCallback((period: TimePeriod) => {
    dispatch({ type: "SET_PERIOD", payload: period });
    dashboardService.updatePeriod(period);
  }, [dashboardService]);

  const refreshData = useCallback(async (supabaseId: string) => {
    dispatch({ type: "REFRESH_DATA" });
    await loadMetrics(supabaseId, { period: state.selectedPeriod });
  }, [loadMetrics, state.selectedPeriod]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const value: DashboardContextValue = {
    state,
    loadMetrics,
    setPeriod,
    refreshData,
    clearError,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// Hook
export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return context;
}