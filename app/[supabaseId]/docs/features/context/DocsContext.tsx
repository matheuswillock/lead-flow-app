"use client"

import { createContext, useContext, useMemo } from "react"
import { DocsService } from "../services/DocsService"
import { useDocsHook } from "./DocsHook"
import type { DocsContextValue } from "./DocsTypes"

const DocsContext = createContext<DocsContextValue | null>(null)

interface DocsProviderProps {
  children: React.ReactNode
}

export function DocsProvider({ children }: DocsProviderProps) {
  const service = useMemo(() => new DocsService(), [])
  const value = useDocsHook(service)

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>
}

export function useDocsContext(): DocsContextValue {
  const context = useContext(DocsContext)
  if (!context) {
    throw new Error("useDocsContext must be used within a DocsProvider")
  }

  return context
}
