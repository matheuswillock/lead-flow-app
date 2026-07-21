"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useRadarHookFn, type RadarHookReturn } from "./useRadarHook"

const RadarContext = createContext<RadarHookReturn | undefined>(undefined)

type Props = { children: ReactNode }

export function RadarProvider({ children }: Props) {
  const value = useRadarHookFn()
  return <RadarContext.Provider value={value}>{children}</RadarContext.Provider>
}

export function useRadarContext(): RadarHookReturn {
  const ctx = useContext(RadarContext)
  if (!ctx) throw new Error("useRadarContext deve ser usado dentro de RadarProvider")
  return ctx
}
