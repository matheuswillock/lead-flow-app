"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useDeliverabilityDashboard } from "./DeliverabilityHook"

type DeliverabilityContextValue = ReturnType<typeof useDeliverabilityDashboard>
const DeliverabilityContext = createContext<DeliverabilityContextValue | null>(null)

export function DeliverabilityProvider({ children }: { children: ReactNode }) {
  return <DeliverabilityContext.Provider value={useDeliverabilityDashboard()}>{children}</DeliverabilityContext.Provider>
}

export function useDeliverabilityContext(): DeliverabilityContextValue {
  const value = useContext(DeliverabilityContext)
  if (!value) throw new Error("useDeliverabilityContext deve ser usado dentro de DeliverabilityProvider")
  return value
}
