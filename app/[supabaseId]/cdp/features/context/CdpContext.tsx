"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCdp, type CdpHookReturn } from "./useCdpHook"

const CdpContext = createContext<CdpHookReturn | undefined>(undefined)

type Props = { children: ReactNode }

export function CdpProvider({ children }: Props) {
  const value = useCdp()
  return <CdpContext.Provider value={value}>{children}</CdpContext.Provider>
}

export function useCdpContext(): CdpHookReturn {
  const ctx = useContext(CdpContext)
  if (!ctx) throw new Error("useCdpContext deve ser usado dentro de CdpProvider")
  return ctx
}
