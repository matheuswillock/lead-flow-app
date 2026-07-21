"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAutomationsHook, type AutomationsContextValue } from "./AutomationsHook";

const AutomationsContext = createContext<AutomationsContextValue | undefined>(undefined);

export function AutomationsProvider({ children }: { children: ReactNode }) {
  const value = useAutomationsHook();
  return <AutomationsContext.Provider value={value}>{children}</AutomationsContext.Provider>;
}

export function useAutomationsContext(): AutomationsContextValue {
  const ctx = useContext(AutomationsContext);
  if (!ctx) {
    throw new Error("useAutomationsContext deve ser usado dentro de AutomationsProvider");
  }
  return ctx;
}
