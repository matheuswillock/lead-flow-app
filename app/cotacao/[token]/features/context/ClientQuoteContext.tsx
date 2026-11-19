"use client";

import { createContext, useContext } from "react";
import { useClientQuoteViewModel, type ClientQuoteViewModel } from "./ClientQuoteHook";
import type { ClientQuoteResult } from "./ClientQuoteTypes";

const ClientQuoteContext = createContext<ClientQuoteViewModel | undefined>(undefined);

export function ClientQuoteProvider({ result, children }: { result: ClientQuoteResult; children: React.ReactNode }) {
  const value = useClientQuoteViewModel(result);
  return <ClientQuoteContext.Provider value={value}>{children}</ClientQuoteContext.Provider>;
}

export function useClientQuote(): ClientQuoteViewModel {
  const context = useContext(ClientQuoteContext);
  if (!context) throw new Error("useClientQuote deve ser usado dentro de ClientQuoteProvider");
  return context;
}
