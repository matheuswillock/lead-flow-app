"use client"

import { createContext, useContext } from "react"
import type { LandingPagesState } from "./LandingPagesTypes"

const LandingPagesContext = createContext<LandingPagesState | null>(null)

export function LandingPagesProvider({ value, children }: { value: LandingPagesState; children: React.ReactNode }) {
  return <LandingPagesContext.Provider value={value}>{children}</LandingPagesContext.Provider>
}

export function useLandingPages() {
  const context = useContext(LandingPagesContext)
  if (!context) throw new Error("useLandingPages deve ser usado dentro de LandingPagesProvider")
  return context
}
