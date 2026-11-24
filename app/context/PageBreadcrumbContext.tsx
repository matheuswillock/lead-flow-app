"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/** Item linkável antes da página atual. `onClick` permite navegação interna (estado da tela) sem trocar de rota. */
export interface BreadcrumbTrailItem {
  label: string;
  href: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface BreadcrumbOverride {
  label: string;
  href?: string;
  /** Itens linkáveis exibidos antes de `label`, do mais externo para o mais interno. */
  trail?: BreadcrumbTrailItem[];
}

interface PageBreadcrumbContextValue {
  override: BreadcrumbOverride | null;
  setOverride: (item: BreadcrumbOverride | null) => void;
}

const PageBreadcrumbContext = createContext<PageBreadcrumbContextValue | undefined>(undefined);

export function PageBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<BreadcrumbOverride | null>(null);

  const setOverride = useCallback((item: BreadcrumbOverride | null) => {
    setOverrideState(item);
  }, []);

  return (
    <PageBreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </PageBreadcrumbContext.Provider>
  );
}

export function usePageBreadcrumb() {
  const ctx = useContext(PageBreadcrumbContext);
  if (!ctx) throw new Error("usePageBreadcrumb must be used within PageBreadcrumbProvider");
  return ctx;
}
