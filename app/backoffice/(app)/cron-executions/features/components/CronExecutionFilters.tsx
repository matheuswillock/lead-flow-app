"use client"

import { useState } from "react"
import type { BackofficeCronStatus } from "@prisma/client"

type CronExecutionFiltersProps = {
  onFilter: (filters: {
    cronKey?: string
    status?: BackofficeCronStatus
    startDate?: string
    endDate?: string
  }) => void
}

const CRON_KEYS = [
  "email-import",
  "whatsapp-outbox",
  "studio-bot-outbox",
  "dispatch-scheduled",
  "reset-credits",
  "meeting-reminders",
  "task-overdue",
  "lead-status-batch",
  "meeting-follow-up",
  "sync-contacts",
  "ingest-media",
  "cleanup-orphan-media",
  "evaluate-idle",
  "member-pro-expiration",
  "provision-live-campaign",
  "dispatch-email-campaigns",
  "backoffice-email-import",
  "database-backup",
  "webhook-outbox",
  "document-request-reminders",
  "overdue-reminder",
  "studio-bot-ai-rollup",
  "radar-import",
  "engagement-backfill",
]

export function CronExecutionFilters({ onFilter }: CronExecutionFiltersProps) {
  const [cronKey, setCronKey] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  const handleFilter = () => {
    onFilter({
      cronKey: cronKey || undefined,
      status: (status as BackofficeCronStatus) || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
  }

  const handleReset = () => {
    setCronKey("")
    setStatus("")
    setStartDate("")
    setEndDate("")
    onFilter({})
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold mb-4">Filtros</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cron
          </label>
          <select
            value={cronKey}
            onChange={(e) => setCronKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Todos</option>
            {CRON_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Todos</option>
            <option value="running">Executando</option>
            <option value="success">Sucesso</option>
            <option value="failed">Falhou</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Data Início
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Data Fim
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Filtrar
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Limpar
        </button>
      </div>
    </div>
  )
}
