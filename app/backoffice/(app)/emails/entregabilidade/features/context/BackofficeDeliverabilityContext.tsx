"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useBackofficeDeliverability } from "./BackofficeDeliverabilityHook"

type BackofficeDeliverabilityContextValue = ReturnType<typeof useBackofficeDeliverability>
const BackofficeDeliverabilityContext = createContext<BackofficeDeliverabilityContextValue | null>(null)

export function BackofficeDeliverabilityProvider({ children }: { children: ReactNode }) {
  return <BackofficeDeliverabilityContext.Provider value={useBackofficeDeliverability()}>{children}</BackofficeDeliverabilityContext.Provider>
}

export function useBackofficeDeliverabilityContext(): BackofficeDeliverabilityContextValue {
  const value = useContext(BackofficeDeliverabilityContext)
  if (!value) throw new Error("useBackofficeDeliverabilityContext deve ser usado dentro do provider")
  return value
}
