"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useHistorico, type HistoricoHookReturn } from "./HistoricoHook"

const HistoricoContext = createContext<HistoricoHookReturn | undefined>(undefined)

type Props = { children: ReactNode; supabaseId: string }

export function HistoricoProvider({ children, supabaseId }: Props) {
  const value = useHistorico(supabaseId)
  return (
    <HistoricoContext.Provider value={value}>
      {children}
    </HistoricoContext.Provider>
  )
}

export function useHistoricoContext(): HistoricoHookReturn {
  const ctx = useContext(HistoricoContext)
  if (!ctx) throw new Error("useHistoricoContext deve ser usado dentro de HistoricoProvider")
  return ctx
}
