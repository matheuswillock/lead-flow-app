"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useContatos, type ContatosHookReturn } from "./ContatosHook";

const ContatosContext = createContext<ContatosHookReturn | undefined>(undefined);

type ContatosProviderProps = {
  children: ReactNode
  supabaseId: string
}

export function ContatosProvider({ children, supabaseId }: ContatosProviderProps) {
  const value = useContatos(supabaseId);
  return (
    <ContatosContext.Provider value={value}>
      {children}
    </ContatosContext.Provider>
  );
}

export function useContatosContext(): ContatosHookReturn {
  const ctx = useContext(ContatosContext);
  if (!ctx) {
    throw new Error("useContatosContext deve ser usado dentro de ContatosProvider");
  }
  return ctx;
}
