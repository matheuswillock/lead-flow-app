"use client"

import { createContext, useContext, type ReactNode } from "react"
import { acceptanceService } from "../services/AcceptanceService"
import { useAcceptanceHook } from "./AcceptanceHook"
import type { AcceptanceContextValue } from "./AcceptanceTypes"

const AcceptanceContext = createContext<AcceptanceContextValue | null>(null)

export function AcceptanceProvider({ children }: { children: ReactNode }) {
  const value = useAcceptanceHook(acceptanceService)
  return <AcceptanceContext.Provider value={value}>{children}</AcceptanceContext.Provider>
}

export function useAcceptance(): AcceptanceContextValue {
  const context = useContext(AcceptanceContext)
  if (!context) throw new Error("useAcceptance deve ser usado dentro de AcceptanceProvider")
  return context
}

