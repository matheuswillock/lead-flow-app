"use client"

import { RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useCronExecutions } from "../context/useCronExecutionsHook"
import { BackofficeCronExecutionsFiltersBar } from "../components/BackofficeCronExecutionsFiltersBar"
import { BackofficeCronExecutionsTable } from "../components/BackofficeCronExecutionsTable"
import { BackofficeCronExecutionDetailsSheet } from "../components/BackofficeCronExecutionDetailsSheet"

export function CronExecutionsContainer() {
  const { error, loading, refresh } = useCronExecutions()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Execuções de crons</h1>
          <p className="text-sm text-muted-foreground">
            Monitore o status e o histórico de execução dos jobs agendados.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as execuções</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <BackofficeCronExecutionsFiltersBar />
      <BackofficeCronExecutionsTable />
      <BackofficeCronExecutionDetailsSheet />
    </div>
  )
}
