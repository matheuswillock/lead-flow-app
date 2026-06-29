"use client";

import { createContext, ReactNode, useContext } from 'react';
import { useMeetingsHeldHook } from './MeetingsHeldHook';
import type { MeetingsHeldFiltersState, MeetingsHeldData } from './MeetingsHeldTypes';

type MeetingsHeldContextValue = {
  data: MeetingsHeldData | null;
  isLoading: boolean;
  error: string | null;
  filters: MeetingsHeldFiltersState;
  setFilter: <K extends keyof MeetingsHeldFiltersState>(key: K, value: MeetingsHeldFiltersState[K]) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  setPage: (page: number) => void;
  refetch: () => void;
};

const MeetingsHeldContext = createContext<MeetingsHeldContextValue | undefined>(undefined);

export function MeetingsHeldProvider({ children }: { children: ReactNode }) {
  const value = useMeetingsHeldHook();
  return (
    <MeetingsHeldContext.Provider value={value}>
      {children}
    </MeetingsHeldContext.Provider>
  );
}

export function useMeetingsHeldContext(): MeetingsHeldContextValue {
  const ctx = useContext(MeetingsHeldContext);
  if (!ctx) {
    throw new Error('useMeetingsHeldContext deve ser usado dentro de MeetingsHeldProvider');
  }
  return ctx;
}
