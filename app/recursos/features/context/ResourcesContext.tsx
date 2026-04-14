"use client"

import { createContext, useContext, useMemo } from "react"
import { ResourcesService } from "../services/ResourcesService"
import { useResourcesHook } from "./ResourcesHook"
import type { ResourcesContextValue } from "./ResourcesTypes"

const ResourcesContext = createContext<ResourcesContextValue | null>(null)

interface ResourcesProviderProps {
  children: React.ReactNode
}

export function ResourcesProvider({ children }: ResourcesProviderProps) {
  const service = useMemo(() => new ResourcesService(), [])
  const value = useResourcesHook(service)

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>
}

export function useResourcesContext(): ResourcesContextValue {
  const context = useContext(ResourcesContext)
  if (!context) {
    throw new Error("useResourcesContext must be used within a ResourcesProvider")
  }
  return context
}
