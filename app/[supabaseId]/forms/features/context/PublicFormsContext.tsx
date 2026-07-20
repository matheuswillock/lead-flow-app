"use client"

import { createContext, useContext } from "react"
import { usePublicFormsState, type PublicFormsContextValue } from "./PublicFormsHook"

const PublicFormsContext = createContext<PublicFormsContextValue | null>(null)

export function PublicFormsProvider({ children }: { children: React.ReactNode }) {
  return (
    <PublicFormsContext.Provider value={usePublicFormsState()}>
      {children}
    </PublicFormsContext.Provider>
  )
}

export function usePublicForms() {
  const value = useContext(PublicFormsContext)
  if (!value) throw new Error("usePublicForms precisa estar dentro de PublicFormsProvider")
  return value
}
