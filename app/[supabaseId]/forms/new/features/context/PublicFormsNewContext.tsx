"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePublicFormsNew } from "./PublicFormsNewHook"

const PublicFormsNewContext = createContext<ReturnType<typeof usePublicFormsNew> | null>(null)

export function PublicFormsNewProvider({ children }: { children: ReactNode }) {
  const value = usePublicFormsNew()
  return <PublicFormsNewContext.Provider value={value}>{children}</PublicFormsNewContext.Provider>
}

export function usePublicFormsNewContext() {
  const ctx = useContext(PublicFormsNewContext)
  if (!ctx) throw new Error("usePublicFormsNewContext must be used within PublicFormsNewProvider")
  return ctx
}
