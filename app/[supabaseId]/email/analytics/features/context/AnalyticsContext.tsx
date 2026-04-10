"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useAnalytics, type AnalyticsHookReturn } from "./AnalyticsHook"

const AnalyticsContext = createContext<AnalyticsHookReturn | undefined>(undefined)

type Props = { children: ReactNode; supabaseId: string }

export function AnalyticsProvider({ children, supabaseId }: Props) {
  const value = useAnalytics(supabaseId)
  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalyticsContext(): AnalyticsHookReturn {
  const ctx = useContext(AnalyticsContext)
  if (!ctx) throw new Error("useAnalyticsContext deve ser usado dentro de AnalyticsProvider")
  return ctx
}
