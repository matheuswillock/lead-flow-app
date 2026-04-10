"use client"

import { createContext, useContext, useMemo } from "react"
import { ResourceDetailService } from "../services/ResourceDetailService"
import { useResourceDetailHook } from "./ResourceDetailHook"
import type { ResourceDetailContextValue } from "./ResourceDetailTypes"

const ResourceDetailContext = createContext<ResourceDetailContextValue | null>(null)

interface ResourceDetailProviderProps {
  slug: string
  children: React.ReactNode
}

export function ResourceDetailProvider({ slug, children }: ResourceDetailProviderProps) {
  const service = useMemo(() => new ResourceDetailService(), [])
  const value = useResourceDetailHook({ slug, service })

  return <ResourceDetailContext.Provider value={value}>{children}</ResourceDetailContext.Provider>
}

export function useResourceDetailContext(): ResourceDetailContextValue {
  const context = useContext(ResourceDetailContext)
  if (!context) {
    throw new Error("useResourceDetailContext must be used within ResourceDetailProvider")
  }
  return context
}
