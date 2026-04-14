"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCampanhas, type CampanhasHookReturn } from "./CampanhasHook"

const CampanhasContext = createContext<CampanhasHookReturn | undefined>(undefined)

type Props = { children: ReactNode; supabaseId: string }

export function CampanhasProvider({ children, supabaseId }: Props) {
  const value = useCampanhas(supabaseId)
  return (
    <CampanhasContext.Provider value={value}>
      {children}
    </CampanhasContext.Provider>
  )
}

export function useCampanhasContext(): CampanhasHookReturn {
  const ctx = useContext(CampanhasContext)
  if (!ctx) throw new Error("useCampanhasContext deve ser usado dentro de CampanhasProvider")
  return ctx
}
