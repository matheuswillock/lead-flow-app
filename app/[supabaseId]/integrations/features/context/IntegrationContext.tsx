"use client";

import { createContext, useContext } from "react";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useIntegrationHook } from "./IntegrationHook";
import type { IntegrationState } from "./IntegrationTypes";

interface IntegrationContextValue extends IntegrationState {
  refresh: () => Promise<void>;
  saveMetaIntegration: (payload: any) => Promise<void>;
  saveWhatsAppIntegration: (payload: any) => Promise<void>;
  testMetaIntegration: (pageId?: string | null) => Promise<{ pageId: string; totalForms: number } | null>;
  testWhatsAppIntegration: (phoneNumberId?: string | null) => Promise<{ phoneNumberId: string; displayPhoneNumber?: string; verifiedName?: string } | null>;
}

const IntegrationContext = createContext<IntegrationContextValue | undefined>(undefined);

export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const value = useIntegrationHook({ supabaseId, teamId: activeTeamId });

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
};

export function useIntegrationContext() {
  const context = useContext(IntegrationContext);
  if (!context) {
    throw new Error("useIntegrationContext must be used within IntegrationProvider");
  }
  return context;
}
