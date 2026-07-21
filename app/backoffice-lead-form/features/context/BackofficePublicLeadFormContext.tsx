"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useBackofficePublicLeadForm } from "./BackofficePublicLeadFormHook"
import type { IBackofficePublicLeadFormContext } from "./BackofficePublicLeadFormTypes"

const BackofficePublicLeadFormContext = createContext<IBackofficePublicLeadFormContext | null>(
  null,
)

export function BackofficePublicLeadFormProvider({ children }: { children: ReactNode }) {
  const value = useBackofficePublicLeadForm()
  return (
    <BackofficePublicLeadFormContext.Provider value={value}>
      {children}
    </BackofficePublicLeadFormContext.Provider>
  )
}

export function useBackofficePublicLeadFormContext(): IBackofficePublicLeadFormContext {
  const context = useContext(BackofficePublicLeadFormContext)
  if (!context) {
    throw new Error(
      "useBackofficePublicLeadFormContext must be used within BackofficePublicLeadFormProvider",
    )
  }
  return context
}
