"use client";

import { createContext, useContext } from "react";
import { usePmeSimulatorHook } from "./PmeSimulatorHook";
import { pmeSimulatorService } from "../services/PmeSimulatorService";
import type { PmeSimulatorContextValue } from "./PmeSimulatorTypes";

const PmeSimulatorContext = createContext<PmeSimulatorContextValue | undefined>(undefined);

export function PmeSimulatorProvider({ children }: { children: React.ReactNode }) {
  const value = usePmeSimulatorHook(pmeSimulatorService);

  return (
    <PmeSimulatorContext.Provider value={value}>
      {children}
    </PmeSimulatorContext.Provider>
  );
}

export function usePmeSimulatorContext() {
  const context = useContext(PmeSimulatorContext);
  if (!context) {
    throw new Error("usePmeSimulatorContext deve ser usado dentro de PmeSimulatorProvider");
  }
  return context;
}

