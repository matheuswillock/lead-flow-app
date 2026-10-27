"use client";

import { createContext, useContext } from "react";
import { useApiCatalog } from "./ApiCatalogHook";
import type { ApiCatalogState } from "./ApiCatalogTypes";

const ApiCatalogContext = createContext<ApiCatalogState | null>(null);

export function ApiCatalogProvider({ supabaseId, children }: { supabaseId: string; children: React.ReactNode }) {
  const value = useApiCatalog(supabaseId);
  return <ApiCatalogContext.Provider value={value}>{children}</ApiCatalogContext.Provider>;
}

export function useApiCatalogContext(): ApiCatalogState {
  const context = useContext(ApiCatalogContext);
  if (!context) throw new Error("useApiCatalogContext deve ser usado dentro de ApiCatalogProvider");
  return context;
}
