"use client";

import { createContext, ReactNode, useContext } from 'react';
import { usePerformanceHook } from './PerformanceHook';
import type { PerformanceFiltersState, PerformancePreset, PerformanceData, PerformanceTeamScope } from './PerformanceTypes';

type PerformanceContextValue = {
  data: PerformanceData | null;
  lastFetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
  filters: PerformanceFiltersState;
  teamScope: PerformanceTeamScope;
  setTeamScope: (scope: PerformanceTeamScope) => void;
  canUseAllTeamsScope: boolean;
  setFilter: <K extends keyof PerformanceFiltersState>(key: K, value: PerformanceFiltersState[K]) => void;
  setPage: (page: number) => void;
  setPreset: (preset: PerformancePreset) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  clearFilters: () => void;
  refetch: () => void;
};

const PerformanceContext = createContext<PerformanceContextValue | undefined>(undefined);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const value = usePerformanceHook();
  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformanceContext(): PerformanceContextValue {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error('usePerformanceContext deve ser usado dentro de PerformanceProvider');
  return ctx;
}
