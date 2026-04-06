"use client";

import { createContext, ReactNode, useContext } from 'react';
import { useCarteiraHook } from './CarteiraHook';
import type { CarteiraData, CarteiraFiltersState, UpdateCarteiraData } from './CarteiraTypes';

type CarteiraContextValue = {
  data: CarteiraData | null;
  isLoading: boolean;
  error: string | null;
  filters: CarteiraFiltersState;
  setFilter: <K extends keyof CarteiraFiltersState>(key: K, value: CarteiraFiltersState[K]) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
  updateEntry: (leadId: string, data: UpdateCarteiraData) => Promise<void>;
};

const CarteiraContext = createContext<CarteiraContextValue | undefined>(undefined);

export function CarteiraProvider({ children }: { children: ReactNode }) {
  const value = useCarteiraHook();
  return (
    <CarteiraContext.Provider value={value}>
      {children}
    </CarteiraContext.Provider>
  );
}

export function useCarteiraContext(): CarteiraContextValue {
  const ctx = useContext(CarteiraContext);
  if (!ctx) throw new Error('useCarteiraContext deve ser usado dentro de CarteiraProvider');
  return ctx;
}
