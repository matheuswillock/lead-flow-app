"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UseBackofficeCrmTransitionRulesParams } from "../services/IBackofficeCrmTransitionRulesService";
import type { BackofficeCrmTransitionRulesContextValue } from "./BackofficeCrmTransitionRulesTypes";
import { useBackofficeCrmTransitionRules } from "./BackofficeCrmTransitionRulesHook";

const BackofficeCrmTransitionRulesContext =
  createContext<BackofficeCrmTransitionRulesContextValue | null>(null);

export function BackofficeCrmTransitionRulesProvider({
  service,
  children,
}: UseBackofficeCrmTransitionRulesParams & { children: ReactNode }) {
  const value = useBackofficeCrmTransitionRules({ service });
  return (
    <BackofficeCrmTransitionRulesContext.Provider value={value}>
      {children}
    </BackofficeCrmTransitionRulesContext.Provider>
  );
}

export function useBackofficeCrmTransitionRulesContext(): BackofficeCrmTransitionRulesContextValue {
  const ctx = useContext(BackofficeCrmTransitionRulesContext);
  if (!ctx) {
    throw new Error(
      "useBackofficeCrmTransitionRulesContext must be used within BackofficeCrmTransitionRulesProvider"
    );
  }
  return ctx;
}
