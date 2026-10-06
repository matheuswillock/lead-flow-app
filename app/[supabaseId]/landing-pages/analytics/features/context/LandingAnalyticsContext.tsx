"use client"

import { createContext, useContext } from "react"
import type { LandingAnalyticsState } from "./LandingAnalyticsTypes"

const LandingAnalyticsContext = createContext<LandingAnalyticsState>({ isReady: true })
export function LandingAnalyticsProvider({ children }: { children: React.ReactNode }) {
  return <LandingAnalyticsContext.Provider value={{ isReady: true }}>{children}</LandingAnalyticsContext.Provider>
}
export function useLandingAnalyticsContext() { return useContext(LandingAnalyticsContext) }
