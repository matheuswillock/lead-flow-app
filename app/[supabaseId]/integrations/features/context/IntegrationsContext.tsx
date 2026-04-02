"use client";

import { createContext, useContext } from "react";
import { useIntegrations } from "./IntegrationsHook";
import type { IntegrationsState, IntegrationsActions } from "./IntegrationsTypes";

type IntegrationsContextValue = IntegrationsState & IntegrationsActions;

const IntegrationsContext = createContext<IntegrationsContextValue | null>(null);

interface IntegrationsProviderProps {
  supabaseId: string;
  children: React.ReactNode;
}

export function IntegrationsProvider({ supabaseId, children }: IntegrationsProviderProps) {
  const value = useIntegrations(supabaseId);

  return (
    <IntegrationsContext.Provider value={value}>
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrationsContext(): IntegrationsContextValue {
  const context = useContext(IntegrationsContext);
  if (!context) {
    throw new Error("useIntegrationsContext must be used within an IntegrationsProvider");
  }
  return context;
}
