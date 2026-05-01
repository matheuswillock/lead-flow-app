"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { ExpiredAdhesionService } from "../services/ExpiredAdhesionService"
import type { IExpiredAdhesionService } from "../services/IExpiredAdhesionService"
import type { ExpiredAdhesionViewState } from "./ExpiredAdhesionTypes"

interface ExpiredAdhesionContextValue {
  viewState: ExpiredAdhesionViewState
}

const ExpiredAdhesionContext = createContext<ExpiredAdhesionContextValue | null>(null)

export function ExpiredAdhesionProvider({ children }: { children: ReactNode }) {
  const service = useMemo<IExpiredAdhesionService>(() => new ExpiredAdhesionService(), [])
  const viewState = useMemo(() => service.getViewState(), [service])

  return (
    <ExpiredAdhesionContext.Provider value={{ viewState }}>
      {children}
    </ExpiredAdhesionContext.Provider>
  )
}

export function useExpiredAdhesionContext(): ExpiredAdhesionContextValue {
  const context = useContext(ExpiredAdhesionContext)
  if (!context) {
    throw new Error("useExpiredAdhesionContext must be used within ExpiredAdhesionProvider")
  }
  return context
}
