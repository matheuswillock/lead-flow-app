"use client";

import { createContext, ReactNode, useContext } from "react";
import { useLeadTransfersHook } from "./LeadTransfersHook";
import type {
  LeadTransfersData,
  LeadTransfersFiltersState,
} from "./LeadTransfersTypes";

type LeadTransfersContextValue = {
  data: LeadTransfersData | null;
  isLoading: boolean;
  error: string | null;
  filters: LeadTransfersFiltersState;
  setFilter: <K extends keyof LeadTransfersFiltersState>(
    key: K,
    value: LeadTransfersFiltersState[K]
  ) => void;
  setDateRange: (field: "transferDate" | "preScheduledDate" | "scheduledDate", dateFrom: string, dateTo: string) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
};

const LeadTransfersContext = createContext<LeadTransfersContextValue | undefined>(undefined);

export function LeadTransfersProvider({ children }: { children: ReactNode }) {
  const value = useLeadTransfersHook();
  return (
    <LeadTransfersContext.Provider value={value}>
      {children}
    </LeadTransfersContext.Provider>
  );
}

export function useLeadTransfersContext(): LeadTransfersContextValue {
  const ctx = useContext(LeadTransfersContext);
  if (!ctx) {
    throw new Error("useLeadTransfersContext deve ser usado dentro de LeadTransfersProvider");
  }
  return ctx;
}
