"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { StudioEmailHost } from "./studio-email-host-types"

const StudioEmailHostContext = createContext<StudioEmailHost | null>(null)

export function StudioEmailHostProvider({
  host,
  children,
}: {
  host: StudioEmailHost
  children: ReactNode
}) {
  return (
    <StudioEmailHostContext.Provider value={host}>{children}</StudioEmailHostContext.Provider>
  )
}

export function useStudioEmailHost(): StudioEmailHost {
  const host = useContext(StudioEmailHostContext)
  if (!host) {
    throw new Error("useStudioEmailHost deve ser usado dentro de StudioEmailHostProvider")
  }
  return host
}

export function useOptionalStudioEmailHost(): StudioEmailHost | null {
  return useContext(StudioEmailHostContext)
}

export type { StudioEmailHost, StudioEmailHostFlags, StudioEmailHostHrefs, StudioEmailHostRole, StudioEmailHostServices } from "./studio-email-host-types"
