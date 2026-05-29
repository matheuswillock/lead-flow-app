"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface BreadcrumbOverride {
  label: string;
  href?: string;
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
