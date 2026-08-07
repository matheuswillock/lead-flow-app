import type { BackofficeCronExecution } from "@prisma/client"

export type CronExecutionsContextType = {
  executions: BackofficeCronExecution[]
  loading: boolean
  error: string | null
  selectedExecution: BackofficeCronExecution | null
  fetchExecutions: (params?: any) => Promise<void>
  selectExecution: (execution: BackofficeCronExecution | null) => void
}
