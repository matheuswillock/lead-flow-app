"use client"

import type { BackofficeCronExecution } from "@prisma/client"

type CronExecutionDetailsProps = {
  execution: BackofficeCronExecution
  onClose: () => void
}

export function CronExecutionDetails({ execution, onClose }: CronExecutionDetailsProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString("pt-BR")
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-"
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Detalhes da Execução</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Cron Key
              </label>
              <p className="text-gray-900 dark:text-white font-mono text-sm">{execution.cronKey}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Status
              </label>
              <p className="text-gray-900 dark:text-white">{execution.status}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Início
              </label>
              <p className="text-gray-900 dark:text-white">{formatDate(execution.startedAt)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Fim
              </label>
              <p className="text-gray-900 dark:text-white">{formatDate(execution.finishedAt)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Duração
              </label>
              <p className="text-gray-900 dark:text-white">{formatDuration(execution.durationMs)}</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Caminho
              </label>
              <p className="text-gray-900 dark:text-white font-mono text-sm">{execution.cronPath}</p>
            </div>
          </div>

          {execution.errorSummary && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Resumo do Erro
              </label>
              <p className="text-red-600 dark:text-red-400 font-mono text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded">
                {execution.errorSummary}
              </p>
            </div>
          )}

          {execution.errorDetail && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Stack Trace Completo
              </label>
              <pre className="text-red-600 dark:text-red-400 font-mono text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {execution.errorDetail}
              </pre>
            </div>
          )}

          {execution.metadata && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Metadata
              </label>
              <pre className="text-gray-900 dark:text-white font-mono text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                {JSON.stringify(execution.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
