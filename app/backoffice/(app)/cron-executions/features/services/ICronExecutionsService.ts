import type { Output } from "@/lib/output"
import type { CronExecutionStatusKey } from "../context/CronExecutionsContextTypes"

export type ListCronExecutionsParams = {
  cronKey?: string
  status?: CronExecutionStatusKey
  startDate?: string
  endDate?: string
  limit?: number
}

export interface ICronExecutionsService {
  listExecutions(params?: ListCronExecutionsParams): Promise<Output>
}
