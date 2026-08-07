"use client"

import { useEffect } from "react"
import { useCronExecutions } from "../context/CronExecutionsContext"
import { CronExecutionFilters } from "../components/CronExecutionFilters"
import { CronExecutionsList } from "../components/CronExecutionsList"
import { CronExecutionDetails } from "../components/CronExecutionDetails"

export function CronExecutionsContainer() {
  const {
    executions,
    loading,
    error,
    selectedExecution,
    fetchExecutions,
    selectExecution,
  } = useCronExecutions()

  useEffect(() => {
    fetchExecutions()
  }, [fetchExecutions])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Execuções de Crons
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitore o status e histórico de execução dos jobs agendados
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <CronExecutionFilters onFilter={fetchExecutions} />
      
      <CronExecutionsList
        executions={executions}
        loading={loading}
        onSelectExecution={selectExecution}
      />

      {selectedExecution && (
        <CronExecutionDetails
          execution={selectedExecution}
          onClose={() => selectExecution(null)}
        />
      )}
    </div>
  )
}
