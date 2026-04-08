"use client"

import { History } from "lucide-react"
import { LogFiltersBar } from "../components/LogFiltersBar"
import { LogsTable } from "../components/LogsTable"
import { LogDetailSheet } from "../components/LogDetailSheet"

export function HistoricoContainer() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Histórico de Emails</h1>
      </div>

      <LogFiltersBar />
      <LogsTable />
      <LogDetailSheet />
    </div>
  )
}
