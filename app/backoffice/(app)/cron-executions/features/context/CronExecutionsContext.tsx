"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { BackofficeCronExecution } from "@prisma/client"
import type { ICronExecutionsService, ListCronExecutionsParams } from "../services/ICronExecutionsService"
import type { CronExecutionsContextType } from "./CronExecutionsContextTypes"

export const CronExecutionsContext = createContext<CronExecutionsContextType | undefined>(undefined)

type CronExecutionsProviderProps = {
  service: ICronExecutionsService
  children: ReactNode
}

export function CronExecutionsProvider({ service, children }: CronExecutionsProviderProps) {
  const [executions, setExecutions] = useState<BackofficeCronExecution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<BackofficeCronExecution | null>(null)

  const fetchExecutions = useCallback(
    async (params?: ListCronExecutionsParams) => {
      setLoading(true)
      setError(null)

      try {
        const output = await service.listExecutions(params)
        
        if (output.isValid) {
          setExecutions(output.result?.executions ?? [])
        } else {
          setError(output.errorMessages.join(", "))
        }
      } catch (err) {
        setError("Erro ao carregar execuções")
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [service]
  )

  const selectExecution = useCallback((execution: BackofficeCronExecution | null) => {
    setSelectedExecution(execution)
  }, [])

  return (
    <CronExecutionsContext.Provider
      value={{
        executions,
        loading,
        error,
        selectedExecution,
        fetchExecutions,
        selectExecution,
      }}
    >
      {children}
    </CronExecutionsContext.Provider>
  )
}

export function useCronExecutions() {
  const context = useContext(CronExecutionsContext)
  if (!context) {
    throw new Error("useCronExecutions deve ser usado dentro de CronExecutionsProvider")
  }
  return context
}
