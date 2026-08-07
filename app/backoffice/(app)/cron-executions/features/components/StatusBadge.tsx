"use client"

import type { BackofficeCronStatus } from "@prisma/client"

type StatusBadgeProps = {
  status: BackofficeCronStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  }

  const labels = {
    running: "Executando",
    success: "Sucesso",
    failed: "Falhou",
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}
