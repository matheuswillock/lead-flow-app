"use client";

import { createContext, useContext } from "react";
import { usePublicLeadForm } from "./PublicLeadFormHook";
import type { PublicLeadFormState, PublicLeadFormActions } from "./PublicLeadFormTypes";

type PublicLeadFormContextValue = PublicLeadFormState & PublicLeadFormActions;

const PublicLeadFormContext = createContext<PublicLeadFormContextValue | null>(null);

interface PublicLeadFormProviderProps {
  supabaseId: string;
  teamId: string;
  children: React.ReactNode;
}

export function PublicLeadFormProvider({ supabaseId, teamId, children }: PublicLeadFormProviderProps) {
  const value = usePublicLeadForm(supabaseId, teamId);

  return (
    <PublicLeadFormContext.Provider value={value}>
      {children}
    </PublicLeadFormContext.Provider>
  );
}

export function usePublicLeadFormContext(): PublicLeadFormContextValue {
  const context = useContext(PublicLeadFormContext);
  if (!context) {
    throw new Error("usePublicLeadFormContext must be used within a PublicLeadFormProvider");
  }
  return context;
}
