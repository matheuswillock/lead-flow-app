"use client"

import { createContext, useMemo, useState, type ReactNode } from "react"
import type { IEntregasProjectionService } from "../services/IEntregasProjectionService"
import type { IEntregasState, Periodo } from "./EntregasTypes"

export const EntregasContext = createContext<IEntregasState | null>(null)

interface EntregasProviderProps {
  service: IEntregasProjectionService
  children: ReactNode
}

export function EntregasProvider({ service, children }: EntregasProviderProps) {
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const projecao = useMemo(() => service.calcular(periodo), [service, periodo])
  const valor = useMemo<IEntregasState>(() => ({ periodo, setPeriodo, projecao }), [periodo, projecao])

  return <EntregasContext.Provider value={valor}>{children}</EntregasContext.Provider>
}
